/// Marketing-style counts (user, 2026-11-18): one below the real number, then
/// a plus — 171 papers shows "170+", 150 lessons "149+". 0 and 1 stay as is.
String countPlus(int n) => n > 1 ? '${n - 1}+' : '$n';
