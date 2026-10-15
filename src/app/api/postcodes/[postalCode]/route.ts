import { errorResponse } from "@/server/security";
import { lookupSwedishPostcode } from "@/server/locations/postcodes";
import { requireListingContext } from "@/server/vehicles/http";

export async function GET(
  request: Request,
  route: { params: Promise<{ postalCode: string }> },
) {
  try {
    await requireListingContext(request, false);
    const suggestions = await lookupSwedishPostcode(
      (await route.params).postalCode,
    );
    return Response.json({ suggestions });
  } catch (error) {
    return errorResponse(error);
  }
}
