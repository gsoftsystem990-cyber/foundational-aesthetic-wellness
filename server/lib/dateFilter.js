"use strict";

function pad(n) {
  return String(n).padStart(2, "0");
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function toLocalDateKey(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d.getTime())) {
    var raw = String(iso);
    return isDateKey(raw.slice(0, 10)) ? raw.slice(0, 10) : "";
  }
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function parseRange(query) {
  var from = String((query && query.from) || "").trim();
  var to = String((query && query.to) || "").trim();
  return {
    from: isDateKey(from) ? from : "",
    to: isDateKey(to) ? to : ""
  };
}

function inDateRange(iso, from, to) {
  if (!from && !to) return true;
  var key = toLocalDateKey(iso);
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

function filterRows(rows, dateField, query) {
  var range = parseRange(query);
  if (!range.from && !range.to) return rows || [];
  return (rows || []).filter(function (row) {
    return inDateRange(row[dateField], range.from, range.to);
  });
}

module.exports = {
  parseRange: parseRange,
  inDateRange: inDateRange,
  filterRows: filterRows,
  toLocalDateKey: toLocalDateKey
};
