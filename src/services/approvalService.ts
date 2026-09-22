/**
 * Generic Workflow Approval Engine for STOREMAN ERP
 * Handles multi-tier routing (Level 1, Level 2, Finance, Final),
 * audit comments, and prevent unauthorized self-approval.
 */

import { ApprovalRequest, ApprovalStatus, WorkflowType } from '../types';
import { dbRepository } from './dbRepository';
import { generateUUID } from '../lib/utils';
import { auditLogger } from '../lib/auditLogger';

class ApprovalService {
  /**
   * Submits an entity for workflow approval.
   */
  async submitForApproval(params: {
    company_id: string;
    workflow_type: WorkflowType;
    reference_id: string;
    reference_number: string;
    amount?: number;
    requester_id: string;
    requester_name: string;
    comment?: string;
  }): Promise<ApprovalRequest> {
    const id = generateUUID();
    const req: ApprovalRequest = {
      id,
      company_id: params.company_id,
      workflow_type: params.workflow_type,
      reference_id: params.reference_id,
      reference_number: params.reference_number,
      amount: params.amount,
      requester_id: params.requester_id,
      requester_name: params.requester_name,
      current_step: 1,
      total_steps: params.amount && params.amount > 10000 ? 3 : 2, // High-value requires 3 steps
      status: 'Submitted',
      history: [
        {
          step: 1,
          actor_id: params.requester_id,
          actor_name: params.requester_name,
          action: 'Submitted',
          comment: params.comment || 'Submitted for management review',
          timestamp: new Date().toISOString(),
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await dbRepository.insert('approval_requests', req);

    await auditLogger.log({
      userId: params.requester_id,
      companyId: params.company_id,
      action: 'CREATE',
      module: 'APPROVALS',
      entityType: params.workflow_type,
      entityId: id,
      newData: { reference: params.reference_number, status: 'Submitted' },
    });

    return req;
  }

  /**
   * Advances an approval step or marks as Approved upon reaching final step.
   * Prevents self-approval.
   */
  async approveRequest(params: {
    request_id: string;
    approver_id: string;
    approver_name: string;
    comment?: string;
  }): Promise<ApprovalRequest> {
    const req = await dbRepository.getById<ApprovalRequest>('approval_requests', params.request_id);
    if (!req) throw new Error('Approval request not found');

    if (req.status === 'Approved' || req.status === 'Rejected') {
      throw new Error(`This request has already been ${req.status.toLowerCase()}.`);
    }

    // Prevent unauthorized self-approval
    if (req.requester_id === params.approver_id) {
      throw new Error('SELF-APPROVAL FORBIDDEN: Requesters cannot approve their own financial or operational requests.');
    }

    const nextStep = req.current_step + 1;
    let nextStatus: ApprovalStatus = 'Level 1';

    if (nextStep >= req.total_steps) {
      nextStatus = 'Approved';
    } else if (nextStep === 2) {
      nextStatus = 'Finance';
    } else {
      nextStatus = 'Level 2';
    }

    const historyEntry = {
      step: req.current_step,
      actor_id: params.approver_id,
      actor_name: params.approver_name,
      action: 'Approved' as const,
      comment: params.comment || 'Approved step',
      timestamp: new Date().toISOString(),
    };

    const updated = await dbRepository.update<ApprovalRequest>('approval_requests', req.id, {
      current_step: nextStep,
      status: nextStatus,
      history: [...req.history, historyEntry],
      updated_at: new Date().toISOString(),
    });

    await auditLogger.log({
      userId: params.approver_id,
      companyId: req.company_id,
      action: 'APPROVE',
      module: 'APPROVALS',
      entityType: req.workflow_type,
      entityId: req.id,
      newData: { step: nextStep, status: nextStatus, comment: params.comment },
    });

    return updated;
  }

  /**
   * Rejects an approval request with mandatory reason.
   */
  async rejectRequest(params: {
    request_id: string;
    approver_id: string;
    approver_name: string;
    reason: string;
  }): Promise<ApprovalRequest> {
    if (!params.reason || params.reason.trim().length === 0) {
      throw new Error('A rejection reason is strictly required.');
    }

    const req = await dbRepository.getById<ApprovalRequest>('approval_requests', params.request_id);
    if (!req) throw new Error('Approval request not found');

    const historyEntry = {
      step: req.current_step,
      actor_id: params.approver_id,
      actor_name: params.approver_name,
      action: 'Rejected' as const,
      comment: params.reason,
      timestamp: new Date().toISOString(),
    };

    const updated = await dbRepository.update<ApprovalRequest>('approval_requests', req.id, {
      status: 'Rejected',
      history: [...req.history, historyEntry],
      updated_at: new Date().toISOString(),
    });

    await auditLogger.log({
      userId: params.approver_id,
      companyId: req.company_id,
      action: 'REJECT',
      module: 'APPROVALS',
      entityType: req.workflow_type,
      entityId: req.id,
      newData: { status: 'Rejected', reason: params.reason },
    });

    return updated;
  }

  async getPendingRequests(companyId?: string): Promise<ApprovalRequest[]> {
    const all = await dbRepository.getAll<ApprovalRequest>('approval_requests', companyId);
    return all.filter((r) => r.status !== 'Approved' && r.status !== 'Rejected');
  }
}

export const approvalService = new ApprovalService();
