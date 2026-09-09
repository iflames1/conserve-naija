FROM postgres:17-alpine

# Railway: attach a volume at /var/lib/postgresql/data
# Variables on this service:
#   POSTGRES_USER
#   POSTGRES_PASSWORD
#   POSTGRES_DB=conserve_naija

EXPOSE 5432

HEALTHCHECK --interval=10s --timeout=5s --retries=10 \
  CMD pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-conserve_naija}"
