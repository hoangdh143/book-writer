# syntax=docker/dockerfile:1

# book-writer depends on the sibling loki-engine project, which is passed in as a
# named build context. Use `docker compose build`, or:
#   docker build --build-context loki-engine=../loki-engine -t book-writer .

# ---- frontend ----------------------------------------------------------------
FROM node:22-slim AS ui
WORKDIR /build/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# ---- backend -----------------------------------------------------------------
FROM eclipse-temurin:21-jdk AS backend
ARG SBT_VERSION=1.9.9
ADD https://github.com/sbt/sbt/releases/download/v${SBT_VERSION}/sbt-${SBT_VERSION}.tgz /tmp/sbt.tgz
RUN tar -xzf /tmp/sbt.tgz -C /opt && ln -s /opt/sbt/bin/sbt /usr/local/bin/sbt && rm /tmp/sbt.tgz

# build.sbt points at ../loki-engine, so keep the two projects side by side
WORKDIR /build/book-writer
COPY --from=loki-engine build.sbt /build/loki-engine/build.sbt
COPY --from=loki-engine project/build.properties /build/loki-engine/project/build.properties
COPY build.sbt ./
COPY project/build.properties project/build.properties

# dependencies get their own layer, so source edits don't download them again
RUN sbt -batch update

COPY --from=loki-engine src /build/loki-engine/src
COPY src src
RUN sbt -batch -error "export Runtime/fullClasspathAsJars" | tail -n 1 | tr ':' '\n' > /tmp/classpath.txt \
    && mkdir -p /dist/lib \
    && xargs -a /tmp/classpath.txt cp -t /dist/lib \
    && test -f /dist/lib/book-writer_3-0.1.0.jar

# ---- runtime -----------------------------------------------------------------
FROM eclipse-temurin:21-jre
RUN useradd --system --create-home --uid 10001 bookwriter \
    && mkdir -p /app/output \
    && chown -R bookwriter:bookwriter /app

# the server resolves ui/dist and output/ against its working directory
WORKDIR /app
COPY --from=backend /dist/lib lib
COPY --from=ui /build/ui/dist ui/dist

USER bookwriter
VOLUME /app/output
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD curl -fsS http://localhost:8080/api/books > /dev/null || exit 1

ENTRYPOINT ["java", "-Dfile.encoding=UTF-8", "-XX:MaxRAMPercentage=75", "-cp", "/app/lib/*", "bookwriter.Main", "--serve"]
