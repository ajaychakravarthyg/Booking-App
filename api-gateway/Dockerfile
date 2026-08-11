# ── Build stage ──────────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# pom.xml is copied on its own first so the dependency download lands in its own layer.
# Editing source then rebuilds in seconds instead of re-resolving every dependency,
# because this layer stays cached until the pom itself changes.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q clean package -DskipTests

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

EXPOSE 8080

# MaxRAMPercentage is essential in a container: the JVM otherwise sizes its heap from
# the *host's* memory, then gets OOM-killed when it grows past the container limit.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"

HEALTHCHECK --interval=15s --timeout=5s --start-period=50s --retries=5 \
  CMD wget -q --spider http://localhost:8080/actuator/health/readiness || exit 1

# Shell form so $JAVA_OPTS is expanded; exec so the JVM is PID 1 and receives SIGTERM
# directly, which lets Spring's graceful shutdown actually run.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
