import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";

export const metadata = {
  title: "Fighter Registration — Terms & Conditions",
  description:
    "The terms and conditions governing fighter registration on the W.U.C.O Ireland platform.",
};

export default function FighterTermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Fighter Registration — Terms & Conditions">
        By registering as a fighter on the W.U.C.O Ireland platform, you acknowledge
        that you have read, understood and agreed to the following Terms and
        Conditions.
      </PageHeader>
      <Container className="py-10 max-w-3xl">
        <article className="bg-surface border border-border p-6 md:p-10 rounded-xl text-sm text-[#d9ebe2] leading-relaxed space-y-6">
          <Section n="1" title="Purpose of Fighter Registration">
            <P>
              The WUCO Ireland platform facilitates fighter registration, sporting
              records, combat sports management, matchmaking and communication
              between fighters, clubs and authorised promoters.
            </P>
            <P>
              Fighter accounts are intended exclusively for individuals registering
              and participating as fighters.
            </P>
            <P>
              Registration does not guarantee participation in any event,
              competition, championship or promotional activity.
            </P>
          </Section>

          <Section n="2" title="Proper Use of Fighter Accounts">
            <P>
              Fighter profiles must be used exclusively for legitimate
              fighter-related activities.
            </P>
            <P>
              Individuals acting as promoters, event organisers, matchmaking
              representatives or recruitment agents must register and operate
              through an authorised Promoter Account.
            </P>
            <P>Under no circumstances shall a Fighter Account be used to:</P>
            <UL
              items={[
                "Recruit or solicit other registered fighters for events.",
                "Access fighter information for promotional or commercial purposes without authorisation.",
                "Circumvent promoter registration or approval requirements.",
                "Collect, extract, copy or distribute fighter information without permission.",
                "Arrange unauthorised matchmaking or promotional activities using information obtained through the platform.",
                "Act on behalf of a promoter using a Fighter Account.",
              ]}
            />
            <P>
              Individuals operating as both fighters and promoters must use the
              appropriate authorised account for each activity.
            </P>
          </Section>

          <Section n="3" title="Misuse, Suspension and Permanent Banning">
            <P>
              WUCO Ireland maintains a strict policy against the misuse of fighter
              accounts and unauthorised access to fighter information.
            </P>
            <P>
              Where a fighter, promoter or associated representative is found to be
              misusing a Fighter Account for recruitment, promotional activities or
              unauthorised collection of fighter information, WUCO Ireland reserves
              the right to:
            </P>
            <UL
              items={[
                "Immediately restrict or suspend account access where necessary to protect users.",
                "Permanently ban the individual from using the platform following confirmation of a serious violation.",
                "Revoke access to associated Fighter and Promoter Accounts.",
                "Withdraw associated digital fighter credentials where appropriate.",
                "Investigate the misuse and notify relevant parties where lawful and necessary.",
                "Take further disciplinary or legal action where appropriate and permitted by law.",
                "Report suspected unlawful activities to the relevant authorities.",
              ]}
            />
            <P>
              The severity of the action will depend on the nature and circumstances
              of the violation. Users may request a review of an account suspension
              or permanent ban.
            </P>
            <P>
              Creating another account to circumvent a suspension or permanent ban
              is strictly prohibited.
            </P>
          </Section>

          <Section n="4" title="Accuracy of Information">
            <P>
              Fighters are responsible for ensuring that all information submitted
              during registration is accurate, complete and up to date.
            </P>
            <P>This includes, where applicable:</P>
            <UL
              items={[
                "Personal and contact information.",
                "Age and date of birth.",
                "Nationality.",
                "Club affiliation.",
                "Weight and competition division.",
                "Registered combat disciplines.",
                "Experience and classification.",
                "Fight records.",
                "Relevant injuries and medical restrictions.",
                "Competition eligibility and availability.",
              ]}
            />
            <P>
              Providing false, misleading or incomplete information, particularly
              information that may compromise fighter safety, may result in
              rejection of the application, suspension or permanent removal from
              the platform.
            </P>
            <P>
              Fighters must promptly update any information that may affect their
              eligibility or ability to participate safely in combat sports.
            </P>
          </Section>

          <Section n="5" title="Collection and Processing of Personal Information">
            <P>
              WUCO Ireland may collect, store and process personal information
              necessary for the operation of the platform.
            </P>
            <P>Information collected may include:</P>
            <UL
              items={[
                "Full name and profile photograph.",
                "Age and date of birth.",
                "Contact information.",
                "Nationality and club affiliation.",
                "Weight divisions and combat disciplines.",
                "Fight records and competition history.",
                "Membership and registration status.",
                "Relevant injuries, medical restrictions and fitness-to-compete information, where necessary and lawfully collected.",
                "Event participation and matchmaking history.",
              ]}
            />
            <P>Personal information may be processed for the following purposes:</P>
            <UL
              items={[
                "Fighter registration and identity verification.",
                "Maintaining accurate sporting records.",
                "Generating digital fighter passports.",
                "Assessing competition eligibility.",
                "Facilitating appropriate matchmaking.",
                "Identifying potentially suitable opponents.",
                "Recommending fighters to authorised promoters.",
                "Supporting fighter safety and welfare.",
                "Preventing fraud, misconduct and unauthorised platform use.",
                "Managing communications relating to competitions and events.",
              ]}
            />
            <P>
              Personal information will be processed in accordance with applicable
              data protection legislation, including the General Data Protection
              Regulation (GDPR) and the Irish Data Protection Act 2018.
            </P>
            <P>
              Further details regarding data processing, lawful bases, recipients
              and retention periods will be provided in the WUCO Ireland Privacy
              Policy.
            </P>
          </Section>

          <Section n="6" title="Injury and Medical Information">
            <P>
              Fighters acknowledge that relevant injury and medical information may
              be necessary to support safe and appropriate participation in combat
              sports.
            </P>
            <P>
              Where such information is collected, WUCO Ireland will process it
              only where an appropriate legal basis and condition for processing
              health data exist.
            </P>
            <P>
              Where explicit consent is relied upon, it will be obtained separately
              from acceptance of these Terms and Conditions.
            </P>
            <P>
              Medical and injury information will be subject to restricted access
              and will not be publicly displayed on fighter profiles or digital
              fighter passports.
            </P>
            <P>
              Only information necessary for assessing eligibility, safety and
              competition suitability will be collected and shared with
              appropriately authorised individuals.
            </P>
            <P>
              Promoters should ordinarily receive only relevant eligibility or
              availability information rather than detailed medical histories.
            </P>
            <P>
              WUCO Ireland does not provide medical diagnoses, medical advice or
              certification of fitness to compete.
            </P>
            <P>
              Fighters remain responsible for obtaining appropriate medical
              clearance from qualified healthcare professionals.
            </P>
          </Section>

          <Section n="7" title="Matchmaking and Promoter Access">
            <P>
              Fighters acknowledge that relevant sporting information may be made
              available to authorised promoters and matchmaking personnel for
              legitimate event-related purposes.
            </P>
            <P>Such information may include:</P>
            <UL
              items={[
                "Fighter name and club.",
                "Age or appropriate age category.",
                "Weight and competition division.",
                "Registered disciplines.",
                "Experience and classification.",
                "Fight records.",
                "Competition availability.",
                "Relevant eligibility status.",
              ]}
            />
            <P>
              Access to fighter information will be restricted according to
              authorised account roles and legitimate operational requirements.
            </P>
            <P>
              A recommendation, introduction or proposed matchup does not
              constitute a confirmed fight booking or a guarantee of participation.
            </P>
            <P>
              Final participation remains subject to the agreement of the relevant
              parties, appropriate medical clearance and applicable sporting and
              safety requirements.
            </P>
          </Section>

          <Section n="8" title="Role of WUCO Ireland as an Intermediary">
            <P>
              When facilitating matchmaking, fighter recommendations or
              introductions, WUCO Ireland acts as an intermediary between
              registered fighters, clubs, promoters and event organisers.
            </P>
            <P>
              Unless expressly agreed otherwise, WUCO Ireland is not a party to
              individual agreements entered into between fighters and independent
              promoters.
            </P>
            <P>
              The relevant parties remain responsible for agreeing and fulfilling
              matters including:
            </P>
            <UL
              items={[
                "Fight arrangements and contractual obligations.",
                "Fighter payments and financial compensation.",
                "Travel and accommodation.",
                "Event organisation and cancellation.",
                "Insurance coverage.",
                "Medical assessments and clearance.",
                "Competition rules and safety requirements.",
              ]}
            />
            <P>
              WUCO Ireland does not guarantee the performance, conduct or
              contractual compliance of independent third parties.
            </P>
            <P>
              Where WUCO Ireland directly organises, sanctions or undertakes
              responsibilities for an event, its obligations will be determined by
              the applicable event arrangements and law.
            </P>
          </Section>

          <Section n="9" title="Assumption of Sporting Risks">
            <P>
              Fighters acknowledge that combat sports involve inherent physical
              risks, including the possibility of serious injury, permanent
              disability or death.
            </P>
            <P>
              Fighters are responsible for making informed decisions regarding
              their participation and complying with applicable medical, sporting
              and safety requirements.
            </P>
            <P>
              Registration on the platform does not constitute medical clearance,
              confirmation of fitness to compete or a guarantee that a proposed
              matchup is safe.
            </P>
            <P>
              WUCO Ireland&apos;s matchmaking recommendations do not replace
              independent medical assessments or the responsibilities of fighters,
              coaches, promoters and event organisers.
            </P>
          </Section>

          <Section n="10" title="Limitation of Liability">
            <P>
              To the extent permitted by applicable law, WUCO Ireland shall not be
              responsible for losses or disputes arising solely from the
              independent actions, omissions or contractual failures of third-party
              fighters, promoters, clubs or event organisers.
            </P>
            <P>This may include disputes relating to:</P>
            <UL
              items={[
                "Unpaid fighter compensation.",
                "Event cancellations.",
                "Independent contractual arrangements.",
                "Travel and accommodation costs.",
                "Unauthorised arrangements made outside the platform.",
                "False or misleading information supplied by other users.",
              ]}
            />
            <P>
              Nothing in these Terms and Conditions excludes or restricts liability
              where such exclusion or restriction is prohibited by law, including
              applicable liability for negligence resulting in death or personal
              injury.
            </P>
            <P>
              Nothing in these Terms and Conditions removes a user&apos;s statutory
              rights, data protection rights or lawful entitlement to seek a legal
              remedy.
            </P>
          </Section>

          <Section n="11" title="Data Retention and Account Removal">
            <P>
              Personal information will generally be retained for as long as the
              fighter remains registered on the WUCO Ireland platform and the
              information remains necessary for its specified purposes.
            </P>
            <P>
              Fighters may request account closure and deletion of their personal
              information.
            </P>
            <P>Following account closure or permanent removal:</P>
            <UL
              items={[
                "The fighter profile will be deactivated.",
                "Access to the associated digital fighter passport will be withdrawn.",
                "The fighter will be removed from active matchmaking and recruitment processes.",
                "Personal information will be securely deleted or anonymised when no longer required.",
              ]}
            />
            <P>
              Limited information may be retained where necessary to comply with
              legal obligations, resolve disputes, establish or defend legal
              claims, maintain safeguarding records or prevent serious platform
              misuse.
            </P>
            <P>
              Such information will be retained only for as long as necessary and
              lawful.
            </P>
            <P>
              Anonymised sporting statistics that no longer identify an individual
              may be retained for statistical purposes.
            </P>
          </Section>

          <Section n="12" title="Data Protection Rights">
            <P>Subject to applicable law, registered fighters have the right to:</P>
            <UL
              items={[
                "Access their personal information.",
                "Request correction of inaccurate information.",
                "Request deletion of their personal information.",
                "Request restriction of processing.",
                "Object to certain processing activities.",
                "Request data portability where applicable.",
                "Withdraw consent where processing relies on consent.",
                "Submit a complaint to the Irish Data Protection Commission.",
              ]}
            />
            <P>
              Data protection requests may be submitted through the contact details
              provided in the WUCO Ireland Privacy Policy.
            </P>
            <P>
              Withdrawal of consent does not affect the lawfulness of processing
              undertaken before its withdrawal.
            </P>
          </Section>

          <Section n="13" title="Account Security and Confidentiality">
            <P>
              Fighters are responsible for maintaining the confidentiality of their
              login credentials.
            </P>
            <P>
              Users must not share account credentials, provide unauthorised access
              to third parties or allow promoters to operate through their Fighter
              Accounts.
            </P>
            <P>
              Any suspected unauthorised access, account misuse or data breach must
              be reported promptly to WUCO Ireland.
            </P>
          </Section>

          <Section n="14" title="Registration of Minors">
            <P>
              Where registration of minors is permitted, appropriate parent or
              legal guardian authorisation and applicable safeguarding requirements
              must be satisfied.
            </P>
            <P>
              The registration and processing of children&apos;s personal
              information will be subject to additional safeguards.
            </P>
            <P>
              WUCO Ireland reserves the right to request appropriate verification
              before approving a minor&apos;s registration.
            </P>
          </Section>

          <Section n="15" title="Amendments to Terms and Conditions">
            <P>
              WUCO Ireland may update these Terms and Conditions to reflect
              operational, regulatory, legal or security requirements.
            </P>
            <P>
              Users will be notified of material changes and asked to provide
              renewed acceptance where appropriate.
            </P>
          </Section>

          <Section n="16" title="Governing Law and Dispute Resolution">
            <P>
              These Terms and Conditions shall be governed by the applicable laws
              of Ireland, without prejudice to any mandatory legal protections
              available to the user.
            </P>
            <P>
              Users are encouraged to raise concerns directly with WUCO Ireland in
              the first instance so that disputes may be addressed fairly and
              promptly.
            </P>
            <P>Where appropriate, parties may agree to use an independent mediation service.</P>
            <P>
              Nothing in this clause prevents a user from exercising their legal
              rights, seeking independent legal advice or contacting a competent
              court or regulatory authority.
            </P>
          </Section>

          <Section n="17" title="Declaration and Acceptance">
            <P>
              By submitting my fighter registration application, I confirm that:
            </P>
            <UL
              items={[
                "I have read and understood these Terms and Conditions.",
                "The information provided in my application is accurate to the best of my knowledge.",
                "I will use my Fighter Account exclusively for authorised fighter-related activities.",
                "I will not use my Fighter Account to recruit fighters or conduct unauthorised promotional activities.",
                "I understand that misuse may result in account suspension, permanent banning and further appropriate action.",
                "I understand the role of WUCO Ireland when acting as an intermediary.",
                "I acknowledge the inherent risks associated with combat sports.",
                "I have read the WUCO Ireland Privacy Policy and understand how my personal information may be processed.",
              ]}
            />
            <P>
              I agree to comply with these Terms and Conditions as a condition of
              registration and continued access to the WUCO Ireland platform.
            </P>
          </Section>
        </article>
      </Container>
    </>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-base md:text-lg tracking-wider text-gold">
        {n}. {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed">{children}</p>;
}

function UL({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-6 space-y-1 text-sm">
      {items.map((it) => (
        <li key={it}>{it}</li>
      ))}
    </ul>
  );
}
