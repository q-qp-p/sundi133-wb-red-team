#!/usr/bin/env python3
"""
Get a valid ESSO token for the insurance customer assistant API.

Usage:
  python3 scripts/get_esso_token.py <policy_number>

Environment variables (set via export or .env):
  EDGE_LOGIN_URL   - ECAMS login endpoint
  ECAMS_PASSWORD   - ECAMS password
  ECAMS_MFA_OTP    - ECAMS MFA one-time password

Output:
  Prints the ESSO token to stdout (consumed by red-team.ts via preAuthCommand).

Prerequisites:
  pip install ecams-auth
"""

import sys
from ecams_auth import get_valid_token

if __name__ == "__main__":
    policy_number = sys.argv[1] if len(sys.argv) > 1 else "9245099016"
    token = get_valid_token(policy_number)
    print(token, end="")
