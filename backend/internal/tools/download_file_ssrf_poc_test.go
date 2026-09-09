package tools

import "testing"

// TestValidateDownloadURL_BlocksTransitionEncodedAddresses locks in that
// download_file's own URL validation, now routed through the shared
// security.ValidateURLForSSRF guard, rejects NAT64/6to4/Teredo-encoded
// addresses the same way scraper_tool's does.
func TestValidateDownloadURL_BlocksTransitionEncodedAddresses(t *testing.T) {
	blocked := []string{
		"http://[64:ff9b::a9fe:a9fe]/",
		"http://[64:ff9b::7f00:1]/",
		"http://[2002:7f00:1::]/",
		"http://[2001::80ff:fffe]/",
	}
	for _, u := range blocked {
		if _, err := validateDownloadURL(u); err == nil {
			t.Errorf("expected %q to be blocked, but it was allowed", u)
		}
	}
}
