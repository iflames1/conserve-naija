import { PageContainer } from "@/components/common/page-container"
import { ProfilePageSkeleton } from "@/components/common/page-skeleton"

export default function Loading() {
    return (
        <PageContainer width="wide">
            <ProfilePageSkeleton />
        </PageContainer>
    )
}
