# syntax=docker/dockerfile:1.7
#
# Railway builds this repo from the root. Local compose still uses
# backend/Dockerfile with context ./backend — keep the two in sync.

FROM rust:1.94-bookworm AS builder

WORKDIR /src
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/crates ./crates
COPY backend/migrations ./migrations

RUN cargo build --release -p cn-server \
    && strip target/release/cn-server

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /src/target/release/cn-server /app/cn-server
COPY --from=builder /src/migrations /app/migrations

# Do not bake PORT. Railway injects it at runtime and the public proxy
# forwards to that port. Local compose still sets PORT=8080.
ENV HOST=0.0.0.0 \
    MIGRATIONS_DIR=/app/migrations \
    RUST_LOG=info,cn_server=info

EXPOSE 8080

USER nobody

CMD ["/app/cn-server"]
