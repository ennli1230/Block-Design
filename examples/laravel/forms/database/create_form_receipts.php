<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('blockdesign_form_receipts', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('fingerprint', 64);
            $table->json('result')->nullable();
            $table->timestamp('created_at');
        });
    }
    public function down(): void { Schema::dropIfExists('blockdesign_form_receipts'); }
};
