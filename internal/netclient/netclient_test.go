package netclient

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFetchSubscriptionSendsAllHappHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method: %s", r.Method)
		}
		for k, expected := range map[string]string{
			"User-Agent":    "Happ/19.19.19/Windows/2604171131603",
			"X-App-Version": "19.19.19", "X-Device-Locale": "RU", "X-Device-Os": "Windows",
			"X-Device-Model": "Xui_x86_64", "X-Hwid": "test-device",
		} {
			if got := r.Header.Get(k); got != expected {
				t.Errorf("%s = %q, want %q", k, got, expected)
			}
		}
		w.Header().Set("Subscription-Userinfo", "upload=0; download=123; total=234")
		w.Header().Set("Content-Type", "text/plain")
		_, _ = io.WriteString(w, "vless://example")
	}))
	defer server.Close()
	res, err := FetchSubscription(context.Background(), server.URL, map[string]string{
		"User-Agent":    "Happ/19.19.19/Windows/2604171131603",
		"X-App-Version": "19.19.19", "X-Device-Locale": "RU", "X-Device-Os": "Windows",
		"X-Device-Model": "Xui_x86_64", "X-Hwid": "test-device",
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Text != "vless://example" || res.Info == "" || res.Bytes != len(res.Text) {
		t.Fatalf("bad result %+v", res)
	}
}

func TestFetchRejectsNonHTTP(t *testing.T) {
	for _, u := range []string{"file:///etc/passwd", "ftp://example.com/file", "http://user:pass@example.com/file", "http://hello\r\nX-Header: x"} {
		if _, err := FetchSubscription(context.Background(), u, nil); err == nil {
			t.Errorf("accepted %q", u)
		}
	}
}

func TestFetchRejectsHugeResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		for i := 0; i < 210; i++ {
			_, _ = io.WriteString(w, strings.Repeat("a", 65536))
		}
	}))
	defer server.Close()
	if _, err := FetchSubscription(context.Background(), server.URL, nil); err == nil {
		t.Fatal("oversized response accepted")
	}
}

func TestFetchRejectsInvalidHeader(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	defer s.Close()
	if _, err := FetchSubscription(context.Background(), s.URL, map[string]string{"X-Test": "hi\r\nInjected: yes"}); err == nil {
		t.Fatal("accepted CRLF header")
	}
}

func TestFetchRejectsHTTPError(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(401) }))
	defer s.Close()
	_, err := FetchSubscription(context.Background(), s.URL, nil)
	if err == nil || !strings.Contains(err.Error(), "HTTP 401") {
		t.Fatalf("expected 401; got %v", err)
	}
}

func TestCustomHeadersStrippedOnCrossHostRedirect(t *testing.T) {
	second := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Hwid") != "" {
			t.Error("device identifier leaked on redirect")
		}
		if r.Header.Get("Authorization") != "" {
			t.Error("authorization leaked on redirect")
		}
		if r.Header.Get("User-Agent") != "Subscope/2" {
			t.Errorf("user agent after redirect: %s", r.Header.Get("User-Agent"))
		}
		_, _ = io.WriteString(w, "ok")
	}))
	defer second.Close()
	secondURL := strings.Replace(second.URL, "127.0.0.1", "localhost", 1)
	first := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, secondURL, http.StatusFound)
	}))
	defer first.Close()
	res, err := FetchSubscription(context.Background(), first.URL, map[string]string{
		"X-Hwid": "sensitive", "Authorization": "Bearer secret", "User-Agent": "Happ/19.19.19/Windows/2604171131603",
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Text != "ok" {
		t.Fatalf("wrong response: %+v", res)
	}
}

func TestGetJSONAllowsOnlyProviders(t *testing.T) {
	_, err := GetJSON(context.Background(), "https://example.com/foo")
	if err == nil {
		t.Fatal("untrusted endpoint accepted")
	}
}

func TestResolveRejectsMalformedHost(t *testing.T) {
	for _, host := range []string{"http://example.com", "a b", "", "foo/path"} {
		if _, err := ResolveHost(context.Background(), host); err == nil {
			t.Fatalf("accepted %q", host)
		}
	}
}

func TestHTTPSDowngradeIsBlocked(t *testing.T) {
	c := newClient()
	next, err := http.NewRequest(http.MethodGet, "http://example.com/sub", nil)
	if err != nil {
		t.Fatal(err)
	}
	prev, err := http.NewRequest(http.MethodGet, "https://example.com/sub", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := c.CheckRedirect(next, []*http.Request{prev}); err == nil || !strings.Contains(err.Error(), "DOWNGRADE") {
		t.Fatalf("allowed HTTPS downgrade: %v", err)
	}
}

func TestRedirectAcrossPortsRemovesPrivateHeaders(t *testing.T) {
	c := newClient()
	next, _ := http.NewRequest(http.MethodGet, "https://example.com:8443/sub", nil)
	next.Header.Set("X-Hwid", "device-secret")
	next.Header.Set("Authorization", "secret")
	next.Header.Set("User-Agent", "Happ/19.19.19/Windows")
	prev, _ := http.NewRequest(http.MethodGet, "https://example.com:443/sub", nil)
	if err := c.CheckRedirect(next, []*http.Request{prev}); err != nil {
		t.Fatal(err)
	}
	if next.Header.Get("X-Hwid") != "" || next.Header.Get("Authorization") != "" {
		t.Fatalf("leaked private headers across ports: %v", next.Header)
	}
	if next.Header.Get("User-Agent") != "Subscope/2" {
		t.Fatal("unexpected UA")
	}
}

func TestNetworkErrorDoesNotExposeSubscriptionToken(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	target := s.URL + "/sub?token=never-expose-me"
	s.Close()
	_, err := FetchSubscription(context.Background(), target, nil)
	if err == nil {
		t.Fatal("expected closed network error")
	}
	if strings.Contains(err.Error(), "never-expose-me") {
		t.Fatalf("secret leaked in error: %v", err)
	}
}
