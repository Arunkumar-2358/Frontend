"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, str, bool, FormError, type ActionState } from "@/lib/action";
import { profileFormFromFormData } from "./profile-input";

// Visibility (lead scope), edit rights and stage-leader checks are enforced by the API.

const leadId = (fd: FormData) => {
  const id = str(fd, "id");
  if (!id) throw new FormError("Missing lead id");
  return id;
};

export async function transitionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = leadId(fd);
    const { message } = await api("POST /v1/leads/{id}/transition", {
      params: { id },
      body: { to: str(fd, "to"), note: str(fd, "note"), tlRemark: str(fd, "tlRemark"), dropReason: str(fd, "dropReason") },
    });
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    return message;
  });
}

export async function saveProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = leadId(fd);
    const { message } = await api("PUT /v1/leads/{id}/profile", { params: { id }, body: profileFormFromFormData(fd) });
    revalidatePath(`/leads/${id}`);
    return message;
  });
}

export async function logContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = leadId(fd);
    const { message } = await api("POST /v1/leads/{id}/contacts", {
      params: { id },
      body: {
        channel: str(fd, "channel"),
        direction: str(fd, "direction"),
        outcome: str(fd, "outcome"),
        notes: str(fd, "notes"),
        nextFollowupAt: str(fd, "nextFollowupAt"),
        firstTimeVerified: bool(fd, "firstTimeVerified"),
      },
    });
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    return message;
  });
}

export async function sendLinkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = leadId(fd);
    const { message } = await api("POST /v1/leads/{id}/enrolment-link", { params: { id }, body: { channel: str(fd, "channel") } });
    revalidatePath(`/leads/${id}`);
    return message;
  });
}

export async function reassignAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = leadId(fd);
    const { message } = await api("POST /v1/leads/{id}/reassign", { params: { id }, body: { toUserId: str(fd, "toUserId") } });
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    return message;
  });
}

export async function deletionRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = leadId(fd);
    const { message } = await api("POST /v1/leads/{id}/deletion-requests", { params: { id }, body: { requestedVia: str(fd, "requestedVia"), reason: str(fd, "reason") } });
    revalidatePath(`/leads/${id}`);
    return message;
  });
}
