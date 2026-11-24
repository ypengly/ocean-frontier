package auth

import "testing"

func TestIssueAndParse(t *testing.T) {
	s := &Service{Secret: []byte("test-secret-test-secret")}
	tok, err := s.issue(Player{ID: "abc", Username: "diver"})
	if err != nil {
		t.Fatal(err)
	}
	p, err := s.Parse(tok)
	if err != nil || p.ID != "abc" || p.Username != "diver" {
		t.Fatalf("unexpected parse result: %+v %v", p, err)
	}
	if _, err := (&Service{Secret: []byte("another-secret-value")}).Parse(tok); err == nil {
		t.Fatal("token signed with a different secret must be rejected")
	}
}

func TestUsernameRule(t *testing.T) {
	for name, ok := range map[string]bool{"ab": false, "diver_01": true, "bad name": false, "ok": false} {
		if usernameRe.MatchString(name) != ok {
			t.Errorf("username %q expected %v", name, ok)
		}
	}
}
