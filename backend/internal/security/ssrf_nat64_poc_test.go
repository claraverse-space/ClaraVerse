package security

import "testing"

// TestValidateURLForSSRF_BlocksTransitionEncodedAddresses locks in that
// ValidateURLForSSRF rejects an IPv6 transition address that embeds a
// blocked IPv4 destination. IsPrivateIP is a pure CIDR-containment check
// against privateIPRanges; NAT64 (64:ff9b::/96), 6to4 (2002::/16), and
// Teredo (2001::/32) are different byte patterns that don't match any of
// those ranges, so a request to one of these addresses reaches its
// embedded IPv4 destination (loopback or cloud metadata) unblocked.
func TestValidateURLForSSRF_BlocksTransitionEncodedAddresses(t *testing.T) {
	blocked := []string{
		"http://[64:ff9b::a9fe:a9fe]/",     // NAT64-encoded 169.254.169.254
		"http://[64:ff9b::7f00:1]/",        // NAT64-encoded 127.0.0.1
		"http://[2002:7f00:1::]/",          // 6to4-encoded 127.0.0.1
		"http://[2001::80ff:fffe]/",        // Teredo-encoded 127.0.0.1 (client IPv4 XORed with 0xffffffff)
	}
	for _, u := range blocked {
		if err := ValidateURLForSSRF(u); err == nil {
			t.Errorf("expected %q to be blocked (embeds an internal/blocked IPv4 destination), but it was allowed", u)
		}
	}
}
