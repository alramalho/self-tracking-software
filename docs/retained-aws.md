# Retained AWS Resources

The backend API now runs on Hetzner behind Caddy at `api.tracking.so`. The old AWS/Flightcontrol backend infrastructure is deprecated and should not be recreated from this repository.

AWS is still used as an external runtime dependency for:

- S3 object storage via `apps/backend-node/src/services/s3Service.ts`
- SES email sending via `apps/backend-node/src/services/sesService.ts`

These resources are intentionally not defined by CDK in this repository. In particular, do not add a new CDK-managed S3 bucket unless the migration plan explicitly protects the existing production bucket from replacement or deletion.

Known production S3 bucket:

- `tracking-software-bucket-production`

The Hetzner backend needs AWS credentials with only the permissions required for S3 object operations and SES email sending. Backend/API infrastructure such as ECS, ALB, WAF, Lambda cron proxies, and Flightcontrol-managed VPC resources should be treated as teardown candidates after live traffic is verified on Hetzner.
