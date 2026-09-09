import { OrganisationNav } from "@/components/organisation/nav"
import { PageContainer } from "@/components/common/page-container"

export default function OrganisationLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <PageContainer width="wide">
            <OrganisationNav />
            {children}
        </PageContainer>
    )
}
