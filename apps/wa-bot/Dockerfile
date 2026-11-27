FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /wa-bot .

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata
COPY --from=build /wa-bot /usr/local/bin/wa-bot
# The linked WhatsApp session (SQLite); mount a volume here.
VOLUME /data
ENTRYPOINT ["wa-bot"]
