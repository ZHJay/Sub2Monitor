package l2_flows

import (
	"testing"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
)

func TestAggregateIntradayHeatmapInvalidDate(t *testing.T) {
	filter := l0_axioms.MetricsFilter{IncludeCache: true}
	if _, err := AggregateIntradayHeatmap(nil, filter, "not-a-date"); err == nil {
		t.Fatal("expected invalid date error")
	}
}
