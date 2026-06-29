const cdk = require('aws-cdk-lib')
const ec2 = require('aws-cdk-lib/aws-ec2')
const iam = require('aws-cdk-lib/aws-iam')
const backup = require('aws-cdk-lib/aws-backup')
const ecs = require('aws-cdk-lib/aws-ecs')
const ecr = require('aws-cdk-lib/aws-ecr')
const codebuild = require('aws-cdk-lib/aws-codebuild')
const codepipeline = require('aws-cdk-lib/aws-codepipeline')
const codepipeline_actions = require('aws-cdk-lib/aws-codepipeline-actions')

class AdHocWorkerValkeyStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const VALKEY_PASSWORD = 'YourSuperSecurePassword123!'

    // 1. Networking & Firewalls
    const vpc = new ec2.Vpc(this, 'ValkeyVpc', {maxAzs: 2})

    const valkeySg = new ec2.SecurityGroup(this, 'ValkeySg', {
      vpc: vpc,
      description: 'Security group for self-hosted Valkey instance',
      allowAllOutbound: true
    })

    const workerSg = new ec2.SecurityGroup(this, 'WorkerSg', {
      vpc: vpc,
      description: 'Security group for ECS BullMQ workers',
      allowAllOutbound: true
    })

    valkeySg.addIngressRule(workerSg, ec2.Port.tcp(6379), 'Allow workers to connect to Valkey')

    // 3. IAM Management Role for EC2 Database host
    const ec2Role = new iam.Role(this, 'ValkeyInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')]
    })

    // 4. Compute & Volume (Valkey Database)
    const instance = new ec2.Instance(this, 'ValkeyInstance', {
      vpc: vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({cpuType: ec2.AmazonLinuxCpuType.ARM_64}),
      securityGroup: valkeySg,
      role: ec2Role,
      vpcSubnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS},
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(15, {
          volumeType: ec2.EbsDeviceVolumeType.GP3,
          encrypted: true,
          deleteOnTermination: false
        })
      }]
    })
    instance.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN)

    // UserData Script Injection
    const userDataCommands = [
      'dnf update -y', 'dnf install -y docker', 'systemctl start docker', 'systemctl enable docker',
      'mkdir -p /var/lib/valkey-data', 'chmod 777 /var/lib/valkey-data',
      `docker run -d --name valkey-bullmq --restart always -p 6379:6379 -v /var/lib/valkey-data:/data valkey/valkey:8.0 valkey-server --requirepass "${VALKEY_PASSWORD}" --appendonly yes --appendfsync everysec --maxmemory 750mb --maxmemory-policy noeviction`
    ]
    userDataCommands.forEach(cmd => instance.userData.addCommands(cmd))

    // Automated Backups Setup
    const backupVault = new backup.BackupVault(this, 'ValkeyBackupVault', {backupVaultName: 'ValkeyDatabaseBackupVault', removalPolicy: cdk.RemovalPolicy.RETAIN})
    const backupPlan = new backup.BackupPlan(this, 'ValkeyBackupPlan', {backupPlanName: 'ValkeyDailyBackupPlan', backupVault: backupVault})
    backupPlan.addRule(new backup.BackupPlanRule({ruleName: 'Daily_3AM_Snapshot', schedule: backup.Schedule.cron({hour: '3', minute: '0'}), deleteAfter: cdk.Duration.days(30)}))
    backupPlan.addSelection('ValkeyTargetSelection', {resources: [backup.BackupResource.fromEc2Instance(instance)], backupSelectionName: 'ValkeyInstanceBackupSelection'})

    // =========================================================================
    // ECS CORE ARCHITECTURE (Single Image, Single Service, Standalone Definition)
    // =========================================================================

    const workerEcrRepo = new ecr.Repository(this, 'WorkerEcrRepo', {repositoryName: 'bullmq-worker-app', removalPolicy: cdk.RemovalPolicy.DESTROY})
    const cluster = new ecs.Cluster(this, 'BullMqWorkerCluster', {vpc: vpc, containerInsights: true})

    const commonEnvironment = {
      VALKEY_HOST: instance.instancePrivateIp,
      VALKEY_PORT: '6379',
      VALKEY_PASSWORD: VALKEY_PASSWORD,
      CLUSTER_NAME: cluster.clusterName
    }

    // --- WORKER CLUSTER A: Continuous Queue Processor Service ---
    const taskDefA = new ecs.FargateTaskDefinition(this, 'PrimaryWorkerTask', {
      memoryLimitMiB: 512,
      cpu: 256
    })

    taskDefA.addContainer('WorkerContainer', {
      image: ecs.ContainerImage.fromEcrRepository(workerEcrRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({streamPrefix: 'PrimaryWorker'}),
      environment: commonEnvironment,
      command: ['node', 'dist/workers/primaryWorker.js']
    })

    const primaryService = new ecs.FargateService(this, 'PrimaryWorkerService', {
      cluster: cluster,
      taskDefinition: taskDefA,
      securityGroups: [workerSg],
      vpcSubnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS},
      desiredCount: 1
    })

    // --- WORKER B: Standalone Ad-Hoc Task Definition (No Service) ---
    const taskDefB = new ecs.FargateTaskDefinition(this, 'AdHocBatchTask', {
      memoryLimitMiB: 2048,  // Allocated larger resources for heavy standalone jobs
      cpu: 1024
    })

    taskDefB.addContainer('WorkerContainer', {
      // By keeping it locked to 'latest', it pulls the latest image built by the pipeline whenever triggered
      image: ecs.ContainerImage.fromEcrRepository(workerEcrRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({streamPrefix: 'AdHocBatch'}),
      environment: {
        ...commonEnvironment,
        SUBNET_IDS: cdk.Fn.join(',', vpc.privateSubnets.map(s => s.subnetId)),
        SECURITY_GROUP_ID: workerSg.securityGroupId
      },
      command: ['node', 'dist/workers/heavyBatchWorker.js']
    })

    // Injected environment variable so Worker A knows exactly which definition string to invoke
    taskDefA.defaultContainer.addEnvironment('BATCH_TASK_DEFINITION_ARN', taskDefB.taskDefinitionArn)

    // =========================================================================
    // CRITICAL: SECURITY POLICIES FOR PROGRAMMATIC RUN_TASK INVOCATION
    // =========================================================================

    // Grant the Primary Worker's task execution context permission to run ECS tasks
    taskDefA.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['ecs:RunTask'],
      resources: [taskDefB.taskDefinitionArn],
      conditions: {
        StringEquals: {'ecs:cluster': cluster.clusterArn}
      }
    }))

    // Grant permission to pass the Task Execution Role and Task Role to the sub-task execution context
    taskDefA.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [taskDefB.executionRole.roleArn, taskDefB.taskRole.roleArn]
    }))

    // =========================================================================
    // CI/CD CODEPIPELINE SETUP
    // =========================================================================
    const buildProject = new codebuild.PipelineProject(this, 'WorkerBuildProject', {
      projectName: 'BullMqWorkerDockerBuilder',
      environment: {privileged: true, buildImage: codebuild.LinuxBuildImage.STANDARD_7_0},
      environmentVariables: {
        REPOSITORY_URI: {value: workerEcrRepo.repositoryUri},
        CONTAINER_NAME: {value: 'WorkerContainer'}
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {commands: ['aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $REPOSITORY_URI']},
          build: {commands: ['docker build -t $REPOSITORY_URI:latest .', 'docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION']},
          post_build: {commands: ['docker push $REPOSITORY_URI:latest', 'docker push $REPOSITORY_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION', 'printf \'[{"name":"%s","imageUri":"%s"}]\' "$CONTAINER_NAME" "$REPOSITORY_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION" > imagedefinitions.json']}
        },
        artifacts: {files: ['imagedefinitions.json']}
      })
    })
    workerEcrRepo.grantPullPush(buildProject)

    const sourceArtifact = new codepipeline.Artifact('SourceArtifact')
    const buildArtifact = new codepipeline.Artifact('BuildArtifact')

    new codepipeline.Pipeline(this, 'WorkerDeliveryPipeline', {
      pipelineName: 'BullMqWorkerContinuousDelivery',
      stages: [
        {
          stageName: 'FetchSource',
          actions: [new codepipeline_actions.CodeStarConnectionsSourceAction({
            actionName: 'GitHub_Pull',
            owner: 'YOUR_GITHUB_USERNAME',
            repo: 'YOUR_GITHUB_REPOSITORY_NAME',
            branch: 'main',
            output: sourceArtifact,
            connectionArn: 'arn:aws:codeconnections:us-east-1:111122223333:connection/abc-123'
          })]
        },
        {
          stageName: 'CompileDockerImage',
          actions: [new codepipeline_actions.CodeBuildAction({actionName: 'Execute_CodeBuild', project: buildProject, input: sourceArtifact, outputs: [buildArtifact]})]
        },
        {
          stageName: 'DeployToClusters',
          actions: [
            // CodePipeline directly targets and recycles the primary processing loop service
            new codepipeline_actions.EcsDeployAction({
              actionName: 'Deploy_To_Primary_Worker_Service',
              service: primaryService,
              input: buildArtifact
            })
          ]
        }
      ]
    })
  }
}

module.exports = {AdHocWorkerValkeyStack}