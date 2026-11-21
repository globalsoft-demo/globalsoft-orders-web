# globalsoft-orders-web — JFrog shift-left demo

Demo repository for the GlobalSoft assessment, brief **Technical Part 3** (IDE, CI/CD gates, Frogbot, SBOM),
against the JFrog SaaS target and the `globalsoft-migration` project.

| Piece | Where | What it shows |
|---|---|---|
| CI gates | `.github/workflows/security-gates.yml` | Phase 1 `jf audit` (source) → build + build-info → phase 2 `jf build-scan` (what was built) → CycloneDX SBOM of the run (`npm sbom`) as an artifact; the Xray SBOM of the scanned build is exported from the platform |
| Frogbot | `.github/workflows/frogbot-scan-pull-request.yml` | PR comment with the CVE and the fixed version |
| IDE | VS Code + JFrog extension, setting `jfrog.watches` | Vulnerable dependency flagged before any build, scoped to the project watch |
| Dependency resolution | `jf npm-config --repo-resolve=company-npm --repo-deploy=globalsoft-migration-orders-npm-dev-local` (run by CI; locally once, with your own server ID — `.jfrog/` is not committed) | Resolve through `company-npm` (project virtual), deploy to the project DEV local |

## How CI authenticates (no stored credentials)

GitHub OIDC → JFrog OIDC integration `github-actions-globalsoft` (audience `jfrog-github`) → project-scoped identity
mapping `globalsoft-migration-ci` (claim `repository_owner` = this organisation) → 1-hour token with the project role
**`ci-pipeline`**: read/deploy in DEV, publish build-info, Xray metadata of builds and repositories. No delete/overwrite,
no PROD, no watch or policy management. All of it is Terraform (`terraform/identity.tf`).

Repository variable required: `JF_URL` = `https://<instance>.jfrog.io`.

## Merge gate

`main` is protected: the checks `gates` (both phases) and `scan-pull-request` (Frogbot) are required, admins included,
so PR #1 cannot be merged. (Branch protection needs a public repository on GitHub Free, or GitHub Team/Enterprise.)

## Frogbot identity (the one CI identity with more privilege)

Uploading Frogbot V3's scan results needs an admin token on this JFrog SaaS (every narrower token
returns 403, tested 21 Nov). Instead of storing one, the OIDC identity mapping `globalsoft-frogbot`
(priority 1) issues a 1-hour admin token **only** to `.github/workflows/frogbot-scan-pull-request.yml@refs/heads/main`.
The workflow runs on `pull_request_target`, so GitHub executes main's copy: a pull request cannot edit it to obtain
the token, and Frogbot V3 analyses the PR statically. Every other workflow matches the project-scoped CI mapping (priority 2) and gets the `ci-pipeline` role token.

## The demo

1. `main` is clean (`ms@2.1.3`): both gates pass.
2. Branch `feature/add-lodash` adds `lodash@4.17.11` (CVE-2019-10744, Critical, fixed in 4.17.12).
   PR #1: `security-gates` fails at **phase 1** (exit 3, 10 violations, before anything is built) and Frogbot comments
   with 6 vulnerabilities (2 Critical), each CVE and its fix version.

## Lessons recorded while building it

- **Commit `package-lock.json`.** Without it `npm ls` fails, `jf audit` sees no dependencies and passes with exit 0.
- **Index the build in Xray** (`xray_binary_manager_builds`), or `jf build-scan` fails with *"not selected for indexing"*.
- **The predefined Developer role cannot run `jf build-scan`** (403). Testing one action at a time showed the scan needs
  both `MANAGE_XRAY_MD_BUILD` and `MANAGE_XRAY_MD_REPOSITORY`. Roles whose name contains a space (e.g. *Security Manager*)
  cannot be named in a token scope. Hence the custom `ci-pipeline` role (verified: overwrite, delete, PROD deploy and
  watch edits all return 403).
