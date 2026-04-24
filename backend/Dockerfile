FROM python:3.11-slim

WORKDIR /app

# Dépendances système pour la compilation de paquets Python natifs
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Installe les dépendances Python (emergentintegrations via index privé Emergent)
RUN pip install --no-cache-dir \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "entrypoint.sh"]
