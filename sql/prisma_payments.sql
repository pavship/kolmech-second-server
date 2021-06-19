SELECT "dateLocal", p."mpProjectId", Per."amoName", amount::integer, P."isIncome", Ac.name, A."rusName", A."isIncome", A."isLoan", purpose
FROM "prisma-mirhosting$prod"."Payment" as P
join "prisma-mirhosting$prod"."_AccountToPayment" as AcP on (P."id" = AcP."B")
join "prisma-mirhosting$prod"."Account" as Ac on (Ac."id" = AcP."A")
join "prisma-mirhosting$prod"."_PaymentArticle" as PA on (P."id" = PA."B")
join "prisma-mirhosting$prod"."Article" as A on (A."id" = PA."A")
left join "prisma-mirhosting$prod"."_PaymentToPerson" PP on (P."id" = PP."A")
left join "prisma-mirhosting$prod"."Person" as Per on (Per."id" = PP."B")
where p."mpProjectId" = 1000430