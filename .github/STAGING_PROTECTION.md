# Branch Protection Checklist

Repository owner should configure the following rules before collaborators begin development.

## main

- Require a pull request before merging
- Require at least 1 approval
- Require review from Code Owners where available
- Require status checks when CI is added
- Block force pushes
- Block branch deletion
- Do not allow direct pushes from Engineer A / B / C

## staging

- Require a pull request before merging
- Require at least 1 approval
- Require status checks when CI is added
- Block force pushes
- Block branch deletion
- Do not allow direct pushes from Engineer A / B / C

## Collaborators

Collaborators only need normal repository write access to:

- pull the repository
- create feature branches
- push their own feature branches
- open pull requests

They do not need repository admin access, secrets management access, or permission to change branch protection rules.
