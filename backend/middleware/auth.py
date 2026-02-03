"""
Clerk Authentication Middleware for FastAPI.
Verifies JWT tokens from Clerk for protected routes.
"""

import os
import httpx
from typing import Optional
from functools import wraps
from datetime import datetime

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient
from dotenv import load_dotenv

load_dotenv()

# Clerk Configuration
CLERK_PUBLISHABLE_KEY = os.getenv("CLERK_PUBLISHABLE_KEY", "")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_JWT_ISSUER = os.getenv("CLERK_JWT_ISSUER", "")  # e.g., https://your-app.clerk.accounts.dev

# JWKS URL for Clerk
# Format: https://<your-frontend-api>.clerk.accounts.dev/.well-known/jwks.json
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "")

# Security scheme
security = HTTPBearer(auto_error=False)

# JWK Client for fetching public keys
_jwk_client: Optional[PyJWKClient] = None


def get_jwk_client() -> Optional[PyJWKClient]:
    """Get or create JWK client for Clerk."""
    global _jwk_client
    
    if _jwk_client is None and CLERK_JWKS_URL:
        try:
            _jwk_client = PyJWKClient(CLERK_JWKS_URL)
        except Exception as e:
            print(f"⚠️ Failed to initialize JWK client: {e}")
    
    return _jwk_client


async def verify_clerk_token(token: str) -> Optional[dict]:
    """
    Verify a Clerk JWT token and return the payload.
    
    Args:
        token: The JWT token from the Authorization header
        
    Returns:
        The decoded token payload if valid, None otherwise
    """
    if not token:
        return None
    
    try:
        # Debug: Print auth config
        print(f"🔍 Auth Config: JWKS_URL={'Set' if CLERK_JWKS_URL else 'Unset'}, ISSUER={CLERK_JWT_ISSUER}")
        
        # Method 1: Using JWKS (recommended)
        jwk_client = get_jwk_client()
        if jwk_client:
            print("🔑 Using JWKS client for verification")
            try:
                signing_key = jwk_client.get_signing_key_from_jwt(token)
                # print(f"🔐 Found signing key: {signing_key.key_id}")
                
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    options={
                        "verify_aud": False,  # Clerk doesn't always set audience
                        "verify_iss": True,
                    },
                    issuer=CLERK_JWT_ISSUER
                )
                print("✅ Token verified successfully via JWKS")
                return payload
            except Exception as e:
                print(f"⚠️ JWKS verification failed: {e}")
                # Fallthrough to other methods? No, usually if JWKS fails, the token is invalid.
                # But let's continue just in case.
        else:
             print("⚠️ No JWKS client available")
        
        # Method 2: Using Secret Key (fallback)
        if CLERK_SECRET_KEY:
            print("🔑 Attempting Secret Key verification")
            payload = jwt.decode(
                token,
                CLERK_SECRET_KEY,
                algorithms=["HS256", "RS256"],
                options={"verify_aud": False}
            )
            print("✅ Token verified successfully via Secret Key")
            return payload
        
        # Method 3: Decode without verification (development only!)
        if os.getenv("SKIP_AUTH_VERIFICATION", "false").lower() == "true":
            payload = jwt.decode(token, options={"verify_signature": False})
            print("⚠️ WARNING: Token verification skipped (development mode)")
            return payload
            
        print("❌ No verification method succeeded")
        return None
        
    except jwt.ExpiredSignatureError:
        print("❌ Token expired")
        return None
    except jwt.InvalidTokenError as e:
        print(f"❌ Invalid token error: {e}")
        return None
    except Exception as e:
        print(f"❌ Token verification unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[str]:
    """
    Get the current user ID from the request.
    Can be used as a dependency in routes.
    
    Returns:
        User ID if authenticated, None otherwise
    """
    if credentials is None:
        return None
    
    token = credentials.credentials
    payload = await verify_clerk_token(token)
    
    if payload:
        # Clerk uses 'sub' for user ID
        return payload.get("sub")
    
    return None


async def require_auth(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> str:
    """
    Require authentication for a route.
    Raises HTTPException if not authenticated.
    
    Returns:
        User ID if authenticated
    """
    # Development mode: Skip auth completely and use dev user
    if os.getenv("SKIP_AUTH_VERIFICATION", "false").lower() == "true":
        # Try to get user ID from token if provided
        if credentials:
            try:
                payload = jwt.decode(credentials.credentials, options={"verify_signature": False})
                user_id = payload.get("sub")
                if user_id:
                    print(f"⚠️ DEV MODE: Using user ID from unverified token: {user_id}")
                    return user_id
            except:
                pass
        
        # Fallback to dev user ID
        dev_user_id = request.headers.get("X-User-ID", "dev_user_123")
        print(f"⚠️ DEV MODE: Using fallback user ID: {dev_user_id}")
        return dev_user_id
    
    # Production mode: Require valid token
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    token = credentials.credentials
    payload = await verify_clerk_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    
    return user_id


class ClerkAuth:
    """
    Clerk authentication dependency class.
    Use as a dependency to get user info in routes.
    """
    
    def __init__(self, required: bool = True):
        """
        Args:
            required: If True, raise 401 if not authenticated.
                     If False, return None for unauthenticated requests.
        """
        self.required = required
    
    async def __call__(
        self,
        request: Request,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
    ) -> Optional[str]:
        if self.required:
            return await require_auth(request, credentials)
        else:
            return await get_current_user(request, credentials)


# Convenience instances
RequireAuth = ClerkAuth(required=True)
OptionalAuth = ClerkAuth(required=False)


# For development: Simple user ID extraction without full verification
async def get_user_id_dev(request: Request) -> Optional[str]:
    """
    Development helper: Extract user ID from various sources.
    DO NOT USE IN PRODUCTION.
    """
    # Check Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            # Decode without verification
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload.get("sub")
        except:
            pass
    
    # Check X-User-ID header (development only)
    user_id = request.headers.get("X-User-ID")
    if user_id:
        print(f"⚠️ Using X-User-ID header (dev mode): {user_id}")
        return user_id
    
    # Check query parameter (development only)
    user_id = request.query_params.get("userId")
    if user_id:
        print(f"⚠️ Using userId query param (dev mode): {user_id}")
        return user_id
    
    return None
