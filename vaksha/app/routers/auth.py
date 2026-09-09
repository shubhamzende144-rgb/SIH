from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta
from app.config import settings

router = APIRouter(prefix="/v1/auth", tags=["Authentication"])
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(req: LoginRequest):
    if req.email == settings.ADMIN_EMAIL and req.password == settings.ADMIN_PASSWORD:
        payload = {
            "sub": req.email,
            "exp": datetime.utcnow() + timedelta(hours=24)
        }
        token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
        return {"token": token}
    raise HTTPException(status_code=401, detail="Invalid email or password")
