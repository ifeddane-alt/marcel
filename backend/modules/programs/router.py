from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from .schemas import ProgramCreate, ProgramUpdate
from . import service

router = APIRouter(tags=["programs"])


@router.get("/programs")
async def list_programs(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_programs(current_user)


@router.get("/programs/{program_id}")
async def get_program(program_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_program(program_id, current_user)


@router.post("/programs", status_code=201)
async def create_program(data: ProgramCreate, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_program(data, current_user)


@router.put("/programs/{program_id}")
async def update_program(
    program_id: str,
    data: ProgramUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_program(program_id, data, current_user)


@router.delete("/programs/{program_id}", status_code=204)
async def delete_program(program_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_program(program_id, current_user)
