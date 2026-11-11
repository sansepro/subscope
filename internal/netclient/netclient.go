package netclient

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

const MaxBodyBytes int64 = 12 * 1024 * 1024

type FetchResult struct {
	Text        string `json:"text"`
	Bytes       int    `json:"bytes"`
	Info        string `json:"info"`
	ContentType string `json:"contentType"`
	Via         string `json:"via"`
}

type DNSResult struct {
	Host  string   `json:"host"`
	IPs   []string `json:"ips"`
	Error string   `json:"error"`
}

func validTarget(input string) (*url.URL, error) {
	if len(input) > 8192 {
		return nil, errors.New("URL / LIMIT")
	}
	u, err := url.Parse(strings.TrimSpace(input))
	if err != nil || u == nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil || u.Fragment != "" {
		return nil, errors.New("URL / INVALID")
	}
	return u, nil
}

func newClient() *http.Client {
	return &http.Client{
		Timeout:   28 * time.Second,
		Transport: &http.Transport{Proxy: http.ProxyFromEnvironment, MaxIdleConns: 16, IdleConnTimeout: 30 * time.Second, TLSHandshakeTimeout: 12 * time.Second, ResponseHeaderTimeout: 18 * time.Second, ForceAttemptHTTP2: true},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 6 {
				return errors.New("REDIRECT / LIMIT")
			}
			previous := via[len(via)-1].URL
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return errors.New("REDIRECT / INVALID")
			}
			if previous.Scheme == "https" && req.URL.Scheme != "https" {
				return errors.New("REDIRECT / DOWNGRADE")
			}
			// Strip private headers on any origin change, including port changes.
			if !strings.EqualFold(previous.Scheme, req.URL.Scheme) || !strings.EqualFold(previous.Host, req.URL.Host) {
				for _, key := range []string{"X-Hwid", "Authorization", "Cookie", "X-App-Version", "X-Device-Locale", "X-Device-Os", "X-Device-Model"} {
					req.Header.Del(key)
				}
				req.Header.Set("User-Agent", "Subscope/2")
			}
			return nil
		},
	}
}

func doGet(ctx context.Context, input string, headers map[string]string) (*http.Response, error) {
	u, err := validTarget(input)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "*/*")
	for k, v := range headers {
		if strings.TrimSpace(k) == "" || len(k) > 120 || len(v) > 2048 || strings.ContainsAny(k, "\r\n") || strings.ContainsAny(v, "\r\n") || !validHeaderName(k) {
			return nil, fmt.Errorf("HEADER / INVALID: %q", k)
		}
		if strings.EqualFold(k, "Host") || strings.EqualFold(k, "Connection") || strings.EqualFold(k, "Content-Length") || strings.EqualFold(k, "Transfer-Encoding") {
			continue
		}
		req.Header.Set(k, v)
	}
	resp, err := newClient().Do(req)
	if err != nil {
		// url.Error includes the full subscription URL (often a private token).
		var urlErr *url.Error
		if errors.As(err, &urlErr) && urlErr.Err != nil {
			err = urlErr.Err
		}
		return nil, fmt.Errorf("NETWORK / %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		resp.Body.Close()
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	if resp.ContentLength > MaxBodyBytes {
		resp.Body.Close()
		return nil, errors.New("SIZE / LIMIT")
	}
	return resp, nil
}

func validHeaderName(s string) bool {
	for _, r := range s {
		if !((r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || strings.ContainsRune("!#$%&'*+-.^_`|~", r)) {
			return false
		}
	}
	return s != ""
}

func bodyBytes(resp *http.Response) ([]byte, error) {
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, MaxBodyBytes+1))
	if err != nil {
		return nil, fmt.Errorf("READ / %w", err)
	}
	if int64(len(b)) > MaxBodyBytes {
		return nil, errors.New("SIZE / LIMIT")
	}
	return b, nil
}

func FetchSubscription(ctx context.Context, target string, headers map[string]string) (FetchResult, error) {
	resp, err := doGet(ctx, target, headers)
	if err != nil {
		return FetchResult{}, err
	}
	b, err := bodyBytes(resp)
	if err != nil {
		return FetchResult{}, err
	}
	if len(strings.TrimSpace(string(b))) == 0 {
		return FetchResult{}, errors.New("SUB / EMPTY")
	}
	if !utf8.Valid(b) {
		return FetchResult{}, errors.New("SUB / ENCODING")
	}
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(string(b))), "<!doctype html") || strings.HasPrefix(strings.ToLower(strings.TrimSpace(string(b))), "<html") {
		return FetchResult{}, errors.New("SUB / HTML")
	}
	return FetchResult{Text: string(b), Bytes: len(b), Info: resp.Header.Get("Subscription-Userinfo"), ContentType: resp.Header.Get("Content-Type"), Via: "NATIVE"}, nil
}

var jsonProviders = map[string]bool{"ipwho.is": true, "stat.ripe.net": true, "ipapi.co": true}

func GetJSON(ctx context.Context, target string) (string, error) {
	u, err := validTarget(target)
	if err != nil {
		return "", err
	}
	if u.Scheme != "https" || !jsonProviders[strings.ToLower(u.Hostname())] {
		return "", errors.New("GEO / DOMAIN")
	}
	resp, err := doGet(ctx, target, map[string]string{"Accept": "application/json"})
	if err != nil {
		return "", err
	}
	b, err := bodyBytes(resp)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func ResolveHost(ctx context.Context, host string) (DNSResult, error) {
	host = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(host), "."))
	if host == "" || len(host) > 253 || strings.ContainsAny(host, "/\\ :@?\t\r\n") {
		return DNSResult{}, errors.New("DNS / HOST")
	}
	for _, label := range strings.Split(host, ".") {
		if len(label) == 0 || len(label) > 63 {
			return DNSResult{}, errors.New("DNS / HOST")
		}
	}
	ctx, cancel := context.WithTimeout(ctx, 9*time.Second)
	defer cancel()
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	result := DNSResult{Host: host, IPs: []string{}}
	if err != nil {
		result.Error = "DNS ERROR"
		return result, nil
	}
	seen := map[string]bool{}
	for _, item := range ips {
		ip := item.IP
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() || ip.IsMulticast() {
			continue
		}
		s := ip.String()
		if !seen[s] {
			seen[s] = true
			result.IPs = append(result.IPs, s)
		}
	}
	if len(result.IPs) == 0 {
		result.Error = "Нет A/AAAA"
	}
	return result, nil
}
