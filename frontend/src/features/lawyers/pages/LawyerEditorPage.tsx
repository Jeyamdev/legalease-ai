import { useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { catalogApi, lawyersApi } from "../api/lawyers";
import LawyerForm from "../components/LawyerForm";
import { Feedback } from "../components/Shared";
import { useResource } from "../hooks/useResource";
export default function LawyerEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const resource = useResource(
    useCallback(
      async (signal: AbortSignal) => {
        const [specs, services, lawyer] = await Promise.all([
          catalogApi.list("specializations", signal),
          catalogApi.list("legal-services", signal),
          id ? lawyersApi.get(id, signal) : Promise.resolve(undefined),
        ]);
        return { specs, services, lawyer };
      },
      [id],
    ),
  );
  return (
    <>
      <Link to="/admin/lawyer-management" className="underline">
        Back to lawyers
      </Link>
      <h1 className="font-display text-3xl">
        {id ? "Edit lawyer" : "Add lawyer"}
      </h1>
      <Feedback {...resource} retry={resource.reload} />
      {resource.data && (
        <LawyerForm
          {...resource.data}
          onSave={async (v) => {
            const result = await lawyersApi.save(v, id);
            navigate(`/admin/lawyer-management/${result.lawyerId}`);
          }}
        />
      )}
    </>
  );
}
