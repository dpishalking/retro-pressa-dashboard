export { ANALYTICS_SAMPLE_THRESHOLDS, isLowSample } from "./thresholds";
export {
  SLICE_DIMENSIONS,
  SLICE_METRICS,
  getSliceDimension,
  parseSliceDimension,
  parseSliceMetric,
  sliceExplorerHref,
  sliceMetricHint
} from "./registry";
export { buildSliceReport, emptySliceFilters, isUnknownSliceKey } from "./build-slices";
export type {
  SliceDimensionId,
  SliceFilters,
  SliceMetricId,
  SliceReport,
  SliceRow,
  SliceRowStatus
} from "./types";
