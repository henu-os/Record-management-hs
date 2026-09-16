// ============================================================
// Lien Mark Register Layout Definition (Portrait)
// Excel Authority: "Bank Lien Mark - Portrait" sheet
// Card/form layout with 4 repeating loan sections
// ============================================================

export interface LienMarkDefinitionType {
  orientation: 'Portrait';
  title: string;
  loanSections: { title: string; prefix: string }[];
}

export const LienMarkDefinition: LienMarkDefinitionType = {
  orientation: 'Portrait',
  title: 'REGISTER OF LIEN MARK',
  loanSections: [
    { title: 'PARTICULARS OF LOAN - 1st LOAN',                    prefix: 'loan1' },
    { title: 'PARTICULARS OF LOAN - 2nd LOAN OR LOAN TOP-UP',     prefix: 'loan2' },
    { title: 'PARTICULARS OF LOAN - 3rd LOAN OR LOAN TOP-UP',     prefix: 'loan3' },
    { title: 'PARTICULARS OF LOAN - 4th LOAN OR LOAN TOP-UP',     prefix: 'loan4' },
  ],
};
