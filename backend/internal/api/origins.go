package api

import (
	"slices"
	"strings"
)

// origins holds the websites allowed to read the API's responses. An entry is
// "*", an exact origin, or an origin whose host starts with "*.", which allows
// every subdomain of the rest of the host but not the host itself.
type origins struct {
	any       bool
	exact     []string
	wildcards []wildcardOrigin
}

type wildcardOrigin struct {
	prefix, suffix string
}

func parseOrigins(entries []string) origins {
	var parsed origins
	for _, entry := range entries {
		if entry == "*" {
			parsed.any = true
			continue
		}
		if scheme, parent, ok := strings.Cut(entry, "://*."); ok {
			parsed.wildcards = append(parsed.wildcards, wildcardOrigin{prefix: scheme + "://", suffix: "." + parent})
			continue
		}
		parsed.exact = append(parsed.exact, entry)
	}
	return parsed
}

func (o origins) allow(origin string) bool {
	return slices.Contains(o.exact, origin) || slices.ContainsFunc(o.wildcards, func(w wildcardOrigin) bool {
		return w.matches(origin)
	})
}

func (w wildcardOrigin) matches(origin string) bool {
	rest, ok := strings.CutPrefix(origin, w.prefix)
	if !ok {
		return false
	}
	subdomain, ok := strings.CutSuffix(rest, w.suffix)
	return ok && isHostLabels(subdomain)
}

func isHostLabels(host string) bool {
	for label := range strings.SplitSeq(host, ".") {
		if label == "" || strings.ContainsFunc(label, func(r rune) bool {
			return r != '-' && (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9')
		}) {
			return false
		}
	}
	return true
}
