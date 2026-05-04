import { create } from 'zustand'
import type { Project, AnalysisOptions, BookmarkType, Segment } from '../types'
import { DEFAULT_ANALYSIS_OPTIONS } from '../types'

interface ProjectStore {
  project: Project | null
  mediaPath: string | null
  mediaHash: string | null
  mimeType: string | null
  isAnalyzing: boolean
  analysisError: string | null
  analysisOptions: AnalysisOptions

  setProject(project: Project, mediaPath: string, mimeType: string): void
  setAnalyzing(analyzing: boolean): void
  setAnalysisError(error: string | null): void
  setAnalysisOptions(opts: Partial<AnalysisOptions>): void
  /** Update a segment's bookmark in place; returns the updated project or null. */
  updateSegmentBookmark(segId: string, bookmark: BookmarkType | undefined): Project | null
  /** Merge the given segment IDs into a single group segment; returns the updated project. */
  groupSegments(segmentIds: string[]): Project | null
  /** Dissolve a group segment back into its original constituents; returns the updated project. */
  ungroupSegment(groupId: string): Project | null
  reset(): void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  mediaPath: null,
  mediaHash: null,
  mimeType: null,
  isAnalyzing: false,
  analysisError: null,
  analysisOptions: DEFAULT_ANALYSIS_OPTIONS,

  setProject(project, mediaPath, mimeType) {
    set({ project, mediaPath, mediaHash: project.mediaHash, mimeType, analysisError: null, isAnalyzing: false })
  },

  setAnalyzing(analyzing) {
    set({ isAnalyzing: analyzing, analysisError: null })
  },

  setAnalysisError(error) {
    set({ analysisError: error, isAnalyzing: false })
  },

  setAnalysisOptions(opts) {
    set((s) => ({ analysisOptions: { ...s.analysisOptions, ...opts } }))
  },

  updateSegmentBookmark(segId, bookmark) {
    let updated: Project | null = null
    set((s) => {
      if (!s.project) return {}
      const segments = s.project.segments.map((seg) =>
        seg.id === segId ? { ...seg, bookmark } : seg
      )
      updated = { ...s.project, segments, updatedAt: Date.now() }
      return { project: updated }
    })
    return updated
  },

  groupSegments(segmentIds) {
    let updated: Project | null = null
    set((s) => {
      if (!s.project || segmentIds.length < 2) return {}

      const allSegs = s.project.segments

      // Collect selected top-level items (no parentGroupId)
      const selected = allSegs
        .filter((seg) => segmentIds.includes(seg.id) && !seg.parentGroupId)
        .sort((a, b) => a.startMs - b.startMs)

      if (selected.length < 2) return {}

      // Any existing group items in the selection get dissolved — their children
      // become direct constituents of the new group instead.
      const existingGroupIds = selected.filter((s) => s.childIds?.length).map((s) => s.id)
      const childrenOfDissolved = allSegs.filter(
        (seg) => seg.parentGroupId && existingGroupIds.includes(seg.parentGroupId)
      )

      // The new group's direct children: non-group selected items + children of dissolved groups
      const newChildIds = [
        ...selected.filter((s) => !s.childIds?.length).map((s) => s.id),
        ...childrenOfDissolved.map((s) => s.id)
      ]
      // Sort by time so childIds is in playback order
      const newChildIdsSorted = newChildIds.sort((a, b) => {
        const sa = allSegs.find((x) => x.id === a)!
        const sb = allSegs.find((x) => x.id === b)!
        return sa.startMs - sb.startMs
      })

      const groupId = `grp-${Date.now()}`
      const groupSegment: Segment = {
        id: groupId,
        startMs: selected[0].startMs,
        endMs: selected[selected.length - 1].endMs,
        source: 'silence',
        childIds: newChildIdsSorted
      }

      const segments = [
        ...allSegs
          // Remove dissolved group items
          .filter((seg) => !existingGroupIds.includes(seg.id))
          .map((seg) => {
            // Mark selected non-group items as part of new group
            if (segmentIds.includes(seg.id) && !seg.childIds?.length)
              return { ...seg, parentGroupId: groupId }
            // Re-parent children of dissolved groups to new group
            if (seg.parentGroupId && existingGroupIds.includes(seg.parentGroupId))
              return { ...seg, parentGroupId: groupId }
            return seg
          }),
        groupSegment
      ].sort((a, b) => a.startMs - b.startMs)

      updated = { ...s.project, segments, updatedAt: Date.now() }
      return { project: updated }
    })
    return updated
  },

  ungroupSegment(groupId) {
    let updated: Project | null = null
    set((s) => {
      if (!s.project) return {}
      const segments = s.project.segments
        .filter((seg) => seg.id !== groupId)
        .map((seg) =>
          seg.parentGroupId === groupId ? { ...seg, parentGroupId: undefined } : seg
        )
      updated = { ...s.project, segments, updatedAt: Date.now() }
      return { project: updated }
    })
    return updated
  },

  reset() {
    set({
      project: null,
      mediaPath: null,
      mediaHash: null,
      mimeType: null,
      isAnalyzing: false,
      analysisError: null
    })
  }
}))
