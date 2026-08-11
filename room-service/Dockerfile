# ── Build stage ──────────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

COPY pom.xml .
COPY src ./src

# The cache mount is what makes this tolerable. Without it, each of the five services
# downloads its own copy of Spring Boot and Spring Cloud — measured at well over 30
# minutes for a cold `docker compose build`. Keyed on the target path, so all five
# services share ONE ~/.m2 and only the first pays the download cost.
#
# A `dependency:go-offline` step in its own layer was the obvious alternative, and it is
# what this originally did. It was dropped: go-offline also resolves every plugin's
# dependencies, which is slow and prone to spurious failures, and the cache mount already
# makes a source-only rebuild fast without it.
#
# Note the cache does not travel with the image, so a cold CI or Render build still
# downloads once — the same cost as before, minus the duplicated work.
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q clean package -DskipTests

# ── Runtime stage ────────────────────────────────────────────────────────────────
# JRE, not JDK: the compiler is build-time only, and dropping it removes a large slice
# of the image and its attack surface.
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Run as an unprivileged user. A container process running as root that gets exploited
# is root inside the container, and that is a much shorter hop to the host.
RUN addgroup -S spring && adduser -S spring -G spring
COPY --from=build --chown=spring:spring /build/target/*.jar app.jar
USER spring

EXPOSE 9082

# MaxRAMPercentage is essential in a container: the JVM otherwise sizes its heap from
# the *host's* memory, then gets OOM-killed when it grows past the container limit.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -XX:TieredStopAtLevel=1"

HEALTHCHECK --interval=15s --timeout=5s --start-period=50s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:9082/actuator/health/readiness || exit 1

# Shell form so $JAVA_OPTS is expanded; exec so the JVM is PID 1 and receives SIGTERM
# directly, which lets Spring's graceful shutdown actually run.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
