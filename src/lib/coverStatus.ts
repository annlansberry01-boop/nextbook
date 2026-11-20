// If several covers fail to arrive, say so once, so a slow Open Library doesn't look like a broken app.
import { toast } from './actions'

let failures = 0
let told = false

export function reportCoverFailure() {
  failures++
  if (failures >= 3 && !told) {
    told = true
    toast("Covers are slow to load from Open Library right now. They'll appear when it catches up.")
  }
}
