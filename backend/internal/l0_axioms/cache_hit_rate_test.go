package l0_axioms

import "testing"

func TestCalculateCacheHitRatePercent(t *testing.T) {
	cases := []struct {
		name     string
		read     int64
		eligible int64
		want     float64
	}{
		{name: "empty", read: 0, eligible: 0, want: 0},
		{name: "no hit", read: 0, eligible: 100, want: 0},
		{name: "standard", read: 75, eligible: 100, want: 75},
		{name: "upper bound", read: 120, eligible: 100, want: 100},
		{name: "negative", read: -1, eligible: 100, want: 0},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			got := CalculateCacheHitRatePercent(testCase.read, testCase.eligible)
			if got != testCase.want {
				t.Fatalf("got %v, want %v", got, testCase.want)
			}
		})
	}
}
