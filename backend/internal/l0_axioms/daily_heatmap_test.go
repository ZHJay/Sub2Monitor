package l0_axioms

import "testing"

func TestAssignHeatLevelsAllZero(t *testing.T) {
	points := []DailyHeatPoint{
		{Date: "2026-01-01", Tokens: 0},
		{Date: "2026-01-02", Tokens: 0},
	}
	levels, out := AssignHeatLevels(points)
	if levels.MaxTokens != 0 {
		t.Fatalf("maxTokens=%d want 0", levels.MaxTokens)
	}
	for _, p := range out {
		if p.Level != 0 {
			t.Fatalf("expected level 0, got %d for %s", p.Level, p.Date)
		}
	}
}

func TestAssignHeatLevelsQuantiles(t *testing.T) {
	// 10 positive samples: 10,20,...,100
	points := make([]DailyHeatPoint, 0, 10)
	for i := 1; i <= 10; i++ {
		points = append(points, DailyHeatPoint{
			Date:   "2026-01-01",
			Tokens: int64(i * 10),
		})
	}
	points = append(points, DailyHeatPoint{Date: "2026-01-02", Tokens: 0})

	_, out := AssignHeatLevels(points)
	if out[len(out)-1].Level != 0 {
		t.Fatalf("zero day level=%d want 0", out[len(out)-1].Level)
	}

	// lowest positive should be 1; highest should be 4
	if out[0].Level != 1 {
		t.Fatalf("lowest positive level=%d want 1", out[0].Level)
	}
	if out[9].Level != 4 {
		t.Fatalf("highest positive level=%d want 4", out[9].Level)
	}
	// mid-high sample should be >= 2
	if out[6].Level < 2 {
		t.Fatalf("mid sample level=%d want >=2", out[6].Level)
	}
}
