package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/wailsapp/wails/v3/pkg/application"
	"subscope/internal/netclient"
	"sync"
	"sync/atomic"
)

// NetworkService implements native subscription, DNS and multi-window APIs.
type NetworkService struct {
	app      *application.App
	mu       sync.RWMutex
	nodeData map[string]string
	nextID   uint64
}

func (n *NetworkService) FetchSubscription(target string, headers map[string]string) (netclient.FetchResult, error) {
	return netclient.FetchSubscription(context.Background(), target, headers)
}
func (n *NetworkService) GetJSON(target string) (string, error) {
	return netclient.GetJSON(context.Background(), target)
}
func (n *NetworkService) ResolveHost(host string) (netclient.DNSResult, error) {
	return netclient.ResolveHost(context.Background(), host)
}

// OpenNodeWindow opens an independent Wails frameless window containing the selected node.
func (n *NetworkService) OpenNodeWindow(payload string) (string, error) {
	if n.app == nil {
		return "", errors.New("APP NOT READY")
	}
	if len(payload) > 4*1024*1024 {
		return "", errors.New("NODE PAYLOAD TOO LARGE")
	}
	if len(payload) < 2 {
		return "", errors.New("EMPTY NODE PAYLOAD")
	}
	var data struct {
		Node json.RawMessage `json:"node"`
	}
	if json.Unmarshal([]byte(payload), &data) != nil || len(data.Node) < 2 || data.Node[0] != '{' {
		return "", errors.New("NODE PAYLOAD / INVALID")
	}
	id := fmt.Sprintf("node-%d", atomic.AddUint64(&n.nextID, 1))
	n.mu.Lock()
	if n.nodeData == nil {
		n.nodeData = make(map[string]string)
	}
	n.nodeData[id] = payload
	if len(n.nodeData) > 80 { // bound memory in prolonged sessions
		for key := range n.nodeData {
			if key != id {
				delete(n.nodeData, key)
				break
			}
		}
	}
	n.mu.Unlock()
	window := n.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name: id, Title: "Subscope / Node", Width: 700, Height: 700,
		MinWidth: 480, MinHeight: 470, Frameless: true,
		DisableResize: false, URL: "/modal.html?id=" + id,
		DefaultContextMenuDisabled: true,
		BackgroundColour:           application.NewRGB(13, 14, 18),
		Windows:                    application.WindowsWindow{DisableFramelessWindowDecorations: true},
	})
	window.Center()
	window.Show()
	window.Focus()
	return id, nil
}
func (n *NetworkService) GetNodeWindowData(id string) (string, error) {
	n.mu.Lock()
	defer n.mu.Unlock()
	v, ok := n.nodeData[id]
	if !ok {
		return "", errors.New("NODE NOT FOUND")
	}
	delete(n.nodeData, id)
	return v, nil
}
func (n *NetworkService) CloseNodeData(id string) {
	n.mu.Lock()
	delete(n.nodeData, id)
	n.mu.Unlock()
}
