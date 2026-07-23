# ADR-003: Linear Regression Forecasting with Confidence Intervals

## Status
Accepted

## Context
Enterprises need cost projections to plan budgets and detect anomalies. The forecasting
engine must produce Best/Expected/Worst case scenarios with confidence intervals for
weekly, monthly, and quarterly horizons.

## Decision
Implement a linear regression model in `app/forecasting/engine.py`:

- **Training data**: Last 30 days of daily spend aggregated from `ai_requests`
- **Algorithm**: Ordinary least squares linear regression on (day_index, daily_cost)
- **Projection**: slope × days_ahead + intercept, clamped to non-negative
- **Confidence bands**: ±1.5σ × √(days_ahead) from the mean daily spend
- **Confidence score**: min(R² × 100, 95%) with a 30% floor
- **Periods**: weekly (7d), monthly (30d), quarterly (90d)
- **Storage**: Forecasts persisted to `cost_forecasts` table with model metadata
  (slope, intercept, R², training points, trend direction)

**Scenario Analysis**: Given a from_model and to_model, computes actual spend vs
simulated spend using real token counts and target model pricing, projecting monthly
savings with a quality impact note.

## Consequences
- Transparent, explainable forecasts (no black-box ML)
- Confidence intervals enable risk-aware budget planning
- Scenario analysis lets FinOps teams evaluate model switches before committing
- R² score surfaces when forecasts are unreliable (low data, high variance)
