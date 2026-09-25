import { createClient } from "npm:@supabase/supabase-js@2.57.4"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!

    const authHeader = req.headers.get("Authorization") || ""
    const token = authHeader.replace("Bearer ", "")

    if (!token || token === anonKey) {
      return new Response(JSON.stringify({ error: "Authentication required." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: adminCheck } = await adminClient
      .from("admin_profiles")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle()

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Admin access required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const url = new URL(req.url)
    const path = url.pathname.replace("/functions/v1/admin-management", "")

    if (req.method === "GET") {
      const { data, error } = await adminClient
        .from("admin_profiles")
        .select("id, admin_id, full_name, created_at, user_id")
        .order("created_at", { ascending: true })

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch admins." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      return new Response(JSON.stringify({ admins: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (req.method === "POST") {
      const body = await req.json()
      const { adminId, fullName, password } = body

      if (!adminId?.trim() || !fullName?.trim() || !password) {
        return new Response(JSON.stringify({ error: "Admin ID, full name, and password are required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const email = `${adminId.trim()}@mau.edu.et`

      const { data: existing } = await adminClient
        .from("admin_profiles")
        .select("id")
        .eq("admin_id", adminId.trim())
        .maybeSingle()

      if (existing) {
        return new Response(JSON.stringify({ error: "This Admin ID is already in use." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (authError) {
        if (authError.message.includes("already")) {
          return new Response(JSON.stringify({ error: "This Admin ID is already registered." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const { error: profileError } = await adminClient
        .from("admin_profiles")
        .insert({
          user_id: authData.user.id,
          admin_id: adminId.trim(),
          full_name: fullName.trim(),
        })

      if (profileError) {
        await adminClient.auth.admin.deleteUser(authData.user.id)
        return new Response(JSON.stringify({ error: "Failed to create admin profile." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      return new Response(JSON.stringify({ success: true, adminId: adminId.trim() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (req.method === "PUT") {
      const body = await req.json()
      const { adminId, fullName } = body

      if (!adminId?.trim() || !fullName?.trim()) {
        return new Response(JSON.stringify({ error: "Admin ID and full name are required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const { error } = await adminClient
        .from("admin_profiles")
        .update({ full_name: fullName.trim() })
        .eq("admin_id", adminId.trim())

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to update admin." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (req.method === "DELETE") {
      const userId = url.searchParams.get("userId")
      const requestingUserId = userData.user.id

      if (!userId) {
        return new Response(JSON.stringify({ error: "User ID is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      if (userId === requestingUserId) {
        return new Response(JSON.stringify({ error: "You cannot delete your own admin account." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const { error: deleteProfileError } = await adminClient
        .from("admin_profiles")
        .delete()
        .eq("user_id", userId)

      if (deleteProfileError) {
        return new Response(JSON.stringify({ error: "Failed to delete admin profile." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId)

      if (deleteAuthError) {
        return new Response(JSON.stringify({ error: "Admin profile removed, but auth account could not be deleted." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
