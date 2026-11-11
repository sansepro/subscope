package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed frontend/dist
var frontendAssets embed.FS

func main() {
	network := &NetworkService{}
	app := application.New(application.Options{
		Name:        "Subscope",
		Description: "Xray subscription inspector",
		Assets:      application.AssetOptions{Handler: application.AssetFileServerFS(frontendAssets)},
		Services:    []application.Service{application.NewService(network)},
	})
	network.app = app
	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:          "main",
		Title:         "Subscope",
		Width:         820,
		Height:        820,
		MinWidth:      490,
		MinHeight:     470,
		Frameless:     true,
		DisableResize: false,
		Windows: application.WindowsWindow{
			DisableFramelessWindowDecorations: true,
		},
		BackgroundColour:           application.NewRGB(13, 14, 18),
		DefaultContextMenuDisabled: true,
		URL:                        "/",
	})
	window.Center()
	window.Show()
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
