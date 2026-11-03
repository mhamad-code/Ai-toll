"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { answerApproval, usePendingApproval } from "@/lib/approvals"
import { HOVER_SHADOW } from "@/lib/ui"

/** Asks before a connector tool changes anything. */
export function ApprovalDialog() {
  const pending = usePendingApproval()

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) answerApproval(false)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Allow this action?</DialogTitle>
          <DialogDescription>{pending?.title}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{pending?.description}</p>
        <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap">
          {pending ? JSON.stringify(pending.args, null, 2) : null}
        </pre>
        <DialogFooter>
          <Button
            variant="outline"
            className={HOVER_SHADOW}
            onClick={() => answerApproval(false)}
          >
            Deny
          </Button>
          <Button className={HOVER_SHADOW} onClick={() => answerApproval(true)}>
            Allow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
