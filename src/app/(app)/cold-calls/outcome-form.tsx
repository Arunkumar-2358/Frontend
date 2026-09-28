import { Input } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { logColdCallAction } from "./actions";

/** The three outcomes of a cold-lead call, as on the TA team 2 sheet. */
export function OutcomeForm({ candidateId }: { candidateId: string }) {
  return (
    <ActionForm action={logColdCallAction} className="space-y-2">
      <input type="hidden" name="candidateId" value={candidateId} />
      <Input name="notes" placeholder="Call notes (optional)" className="w-full py-1 text-xs" />
      <div className="flex flex-wrap gap-2">
        <Submit size="sm" variant="success" name="outcome" value="NEEDS_JOB">Needs a job → Super active</Submit>
        <Submit size="sm" variant="secondary" name="outcome" value="NOT_INTERESTED">Answered – not looking</Submit>
        <Submit size="sm" variant="ghost" name="outcome" value="UNANSWERED">No answer</Submit>
      </div>
    </ActionForm>
  );
}
