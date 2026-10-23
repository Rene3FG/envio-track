from fastapi import FastAPI

from . import models  # noqa: F401  (registra los modelos en Base.metadata)

app = FastAPI(title="EnvíoTrack API")


@app.get("/health")
def health():
    return {"status": "ok"}
