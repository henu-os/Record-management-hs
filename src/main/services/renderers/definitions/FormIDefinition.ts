// ============================================================
// Form I Layout Definition (Portrait)
// Excel Authority: "Form I - Portrait" sheet
// Complex card-style form with merged cells + two data tables
// ============================================================

export interface FormIDefinitionType {
  orientation: 'Portrait';
  title: string;
  subtitle: string;
  sections: {
    particulars: string;
    nomination: string;
    shares: string;
    transfer: string;
  };
}

export const FormIDefinition: FormIDefinitionType = {
  orientation: 'Portrait',
  title: 'FORM "I" REGISTER OF MEMBERS',
  subtitle: 'REGISTER OF MEMBERS [Section 38 (1) of the Maharashtra Co-operative Societies Act, 1960]',
  sections: {
    particulars: 'MEMBER PARTICULARS',
    nomination: 'NOMINATION DETAILS',
    shares: 'PARTICULARS OF SHARES HELD',
    transfer: 'PARTICULARS OF SHARES TRANSFERRED OR SURRENDERED',
  },
};
