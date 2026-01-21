import { useEffect, useState } from "react";
import { useRecoilState } from "recoil";
import {
  createAjaxRequest,
  generateApiUrl,
  KristaId,
} from "../../../toolkit-src";
import { workspaceContactsAtom } from "../../atoms";
import { GET_WORKSPACE_CONTACT } from "./apiURLs";
import { WorkspaceContact } from "../../modules/workspace/contact/WorkspaceContact";

export const useGetContact = (
  workspaceId: string | KristaId | undefined,
  contactId: string | KristaId | undefined
) => {
  const [contact, setContact] = useState<WorkspaceContact>();
  const [loading, setLoading] = useState(true);
  const [workspaceContacts, updateWorkspaceContacts] = useRecoilState(
    workspaceContactsAtom
  );

  useEffect(() => {
    if (!workspaceId || !contactId) {
      setLoading(false);
      return;
    }
    const _workspaceId =
      workspaceId instanceof KristaId ? workspaceId.toString() : workspaceId;
    const _contactId =
      contactId instanceof KristaId ? contactId.toString() : contactId;

    let contactMap: Map<string, WorkspaceContact>;
    let invalidContacts: Set<string>;
    contactMap = workspaceContacts.contactMap;
    invalidContacts = workspaceContacts.invalidContacts;

    if (invalidContacts.has(_contactId)) {
      setLoading(false);
      return;
    }

    let _contact = contactMap.get(_contactId);
    if (_contact) {
      setLoading(false);
      setContact(_contact);
      return;
    }
    setLoading(true);
    createAjaxRequest({
      url: generateApiUrl(GET_WORKSPACE_CONTACT, {
        workspaceId: _workspaceId,
        accountId: _contactId,
      }),
      options: {},
    })
      .then((response) => {
        const _wsContact = WorkspaceContact.create(response.data.payload);
        if (_wsContact) {
          contactMap = contactMap.set(_wsContact.id.toString(), _wsContact);
          setContact(_wsContact);
        } else {
          invalidContacts = invalidContacts.add(_contactId);
        }
      })
      .catch(() => {
        invalidContacts = invalidContacts.add(_contactId);
      })
      .finally(() => {
        updateWorkspaceContacts({ contactMap, invalidContacts });
        setLoading(false);
      });
  }, [
    workspaceId,
    contactId,
    workspaceContacts.contactMap,
    workspaceContacts.invalidContacts,
    updateWorkspaceContacts,
  ]);

  return { contact, loading };
};
