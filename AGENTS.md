## Application rules
- Keep daily poem date and countdown logic in the shared poem-rules module so server and browser agree on rollover.
- Persist a single generated poem per date with a service-only atomic claim; the public generate function is safe to call repeatedly because the claim allows only one paid generation per day.
- Read completed poems publicly through the publishable client and RLS; pending records and generation pause state remain service-only.
- Persist terminal AI failures and credit/access pauses; never automatically replay a failed daily generation.
- Render illustrative cherubs as animated SVG with reduced-motion support to keep the characters lightweight and independent of image services.
