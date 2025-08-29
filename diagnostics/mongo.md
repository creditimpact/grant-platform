# MongoDB Snapshot

- Connection: mongodb://localhost:27017/test
- Collections:
  - DB: test
  - pipelinecases
  - formtemplates

## Samples (3 max per collection)
### pipelinecases
```json
{
    "_id":  "68b1b52f85553a0cc5f4a0ac",
    "userId":  "dev-user",
    "caseId":  "case-1756476719362",
    "status":  "open",
    "eligibility":  {
                        "results":  [
                                        {
                                            "name":  "General Support Grant",
                                            "score":  0,
                                            "certainty_level":  "low",
                                            "estimated_amount":  5000,
                                            "reasoning":  [
                                                              "Fallback grant offered based on partial information"
                                                          ],
                                            "missing_fields":  [

                                                               ],
                                            "next_steps":  "Provide additional information to match specific grants",
                                            "requiredForms":  [
                                                                  "form_sf424"
                                                              ],
                                            "tag_score":  {

                                                          },
                                            "reasoning_steps":  [

                                                                ],
                                            "llm_summary":  "",
                                            "debug":  {
                                                          "fallback":  true
                                                      },
                                            "status":  "conditional",
                                            "rationale":  "Fallback grant based on partial information"
                                        }
                                    ],
                        "requiredForms":  [
                                              "form_sf424"
                                          ],
                        "lastUpdated":  "2025-08-29T14:12:00.111Z"
                    },
    "requiredDocuments":  [
                              "Tax Returns (last 2Γאף3 years)",
                              "Payroll Records (Form 941 / W-2)",
                              "Bank Statements (last 3Γאף6 months)",
                              "Business License / Incorporation Docs",
                              "Owner ID (DriverΓאשs License / Passport)",
                              "Ownership / Officer List (ΓיÑ20% shareholders / officers)",
                              "Financial Statements (P\u0026L + Balance Sheet)"
                          ],
    "documents":  [

                  ],
    "generatedForms":  [

                       ],
    "createdAt":  "2025-08-29T14:11:59.386Z",
    "updatedAt":  "2025-08-29T14:12:00.219Z",
    "__v":  0,
    "analyzer":  {
                     "fields":  {
                                    "legalBusinessName":  "Blue Wave Labs LLC",
                                    "ownerTitle":  "CEO",
                                    "projectStart":  "2024-05-01",
                                    "business_name":  "Blue Wave Labs",
                                    "fundingRequest":  "100000",
                                    "projectTitle":  "Cancer Biomarker Toolkit",
                                    "authorizedRepDateSigned":  "2024-06-01",
                                    "physicalAddress":  {
                                                            "zip":  "94107",
                                                            "street":  "1 Main St",
                                                            "state":  "CA",
                                                            "city":  "SF"
                                                        },
                                    "ein":  "12-3456789",
                                    "ownerFirstName":  "Ari",
                                    "ownerLastName":  "Levy",
                                    "projectEnd":  "2025-05-01",
                                    "applicant_name":  "Blue Wave Labs LLC"
                                },
                     "lastUpdated":  "2025-08-29T14:11:59.755Z"
                 },
    "questionnaire":  {
                          "data":  {
                                       "legalBusinessName":  "Blue Wave Labs LLC",
                                       "ownerTitle":  "CEO",
                                       "projectStart":  "2024-05-01",
                                       "businessName":  "Blue Wave Labs",
                                       "fundingRequest":  "100000",
                                       "projectTitle":  "Cancer Biomarker Toolkit",
                                       "authorizedRepDateSigned":  "2024-06-01",
                                       "physicalAddress":  {
                                                               "zip":  "94107",
                                                               "street":  "1 Main St",
                                                               "state":  "CA",
                                                               "city":  "SF"
                                                           },
                                       "ein":  "12-3456789",
                                       "ownerFirstName":  "Ari",
                                       "ownerLastName":  "Levy",
                                       "projectEnd":  "2025-05-01"
                                   },
                          "lastUpdated":  "2025-08-29T14:11:59.755Z"
                      }
}
```
### formtemplates
```json
```
