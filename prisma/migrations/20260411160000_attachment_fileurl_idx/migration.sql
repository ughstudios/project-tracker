-- Speed up /api/blob/media lookups (one query per ranged video segment).
CREATE INDEX "ProjectAttachment_fileUrl_idx" ON "ProjectAttachment"("fileUrl");
CREATE INDEX "CustomerAttachment_fileUrl_idx" ON "CustomerAttachment"("fileUrl");
CREATE INDEX "IssueAttachment_fileUrl_idx" ON "IssueAttachment"("fileUrl");
CREATE INDEX "IssueThreadAttachment_fileUrl_idx" ON "IssueThreadAttachment"("fileUrl");
