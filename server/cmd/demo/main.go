package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"example.com/blockdesign/reference/internal/application"
	"example.com/blockdesign/reference/internal/httpapi"
	"example.com/blockdesign/reference/internal/repository"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	db, err := repository.OpenSQLite(ctx, os.Getenv("BLOCKDESIGN_DB"))
	if err != nil { logger.Error("SQLite açılamadı", "error", err); os.Exit(1) }
	defer db.Close()
	server := &http.Server{Addr: address(), Handler: httpapi.New(application.New(db)), ReadHeaderTimeout: 5*time.Second}
	go func() {
		logger.Info("BlockDesign referans API hazır", "address", "http://"+server.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("HTTP sunucusu durdu", "error", err)
			stop()
		}
	}()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdown); err != nil { logger.Error("sunucu kapatılamadı", "error", err) }
}

func address() string {
	if value := os.Getenv("BLOCKDESIGN_ADDR"); value != "" { return value }
	return "127.0.0.1:8080"
}
